import { supabase } from './supabase';
import { useTimetableStore } from '../store/timetableStore';
import { Allocation, CourseSection, Room, Student } from '../types/timetable';

/**
 * Keeps the store in step with the shared Supabase database:
 * loads the dataset on start, saves coordinators' changes, and applies other browsers' changes live.
 */

type Table = 'rooms' | 'courses' | 'students' | 'allocations';
interface Dataset {
  rooms: Room[];
  courses: CourseSection[];
  students: Student[];
  allocations: Allocation[];
}

const PAGE = 1000;
const CHUNK = 500;
/** More changed classes than this in one step (e.g. a timetable import) republishes the whole dataset */
const BULK_THRESHOLD = 50;

let started = false;
/** Set while applying data that came from the database, so it is not written straight back */
let applyingRemote = false;
let lastPublishedVersion: number | null = null;

const store = useTimetableStore;

function applyRemote(update: Partial<Dataset>) {
  applyingRemote = true;
  try {
    store.setState(update);
  } finally {
    applyingRemote = false;
  }
}

async function fetchAll<T>(table: Table): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!.from(table).select('data').order('id').range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []).map((r) => r.data as T));
    if (!data || data.length < PAGE) return rows;
  }
}

async function loadAll() {
  store.setState({ syncStatus: 'loading' });
  try {
    const [rooms, courses, students, allocations] = await Promise.all([
      fetchAll<Room>('rooms'),
      fetchAll<CourseSection>('courses'),
      fetchAll<Student>('students'),
      fetchAll<Allocation>('allocations'),
    ]);
    if (allocations.length === 0 || rooms.length === 0) {
      // Nothing published yet: keep the bundled timetable until a coordinator publishes it
      store.setState({ syncStatus: 'empty' });
      return;
    }
    const { selectedRoomId } = store.getState();
    applyRemote({ rooms, courses, students, allocations });
    if (!rooms.some((r) => r.id === selectedRoomId)) store.setState({ selectedRoomId: rooms[0].id });
    store.setState({ syncStatus: 'synced', allocationHistory: [] });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === '42P01' || code === 'PGRST205') {
      // Tables not created yet – supabase/schema.sql has not been run
      console.warn('Shared timetable tables are missing: run supabase/schema.sql in the Supabase SQL editor');
      store.setState({ syncStatus: 'empty' });
      return;
    }
    console.warn('Could not load the shared timetable', err);
    store.setState({ syncStatus: 'offline' });
  }
}

async function replaceTable(table: Table, items: { id: string }[]) {
  const { error } = await supabase!.from(table).delete().neq('id', '');
  if (error) throw error;
  const now = new Date().toISOString();
  for (let i = 0; i < items.length; i += CHUNK) {
    const { error: insertError } = await supabase!
      .from(table)
      .insert(items.slice(i, i + CHUNK).map((item) => ({ id: item.id, data: item, updated_at: now })));
    if (insertError) throw insertError;
  }
}

/** Replaces the whole shared dataset with what this browser has now. */
export async function publishDataset(): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { rooms, courses, students, allocations } = store.getState();
  store.setState({ syncStatus: 'saving' });
  try {
    await replaceTable('rooms', rooms);
    await replaceTable('courses', courses);
    await replaceTable('students', students);
    await replaceTable('allocations', allocations);
    const version = Date.now();
    lastPublishedVersion = version;
    const { error } = await supabase.from('meta').upsert({ key: 'dataset', value: { version }, updated_at: new Date().toISOString() });
    if (error) throw error;
    await supabase.from('change_log').insert({ action: 'publish dataset', after: { allocations: allocations.length, students: students.length } });
    store.setState({ syncStatus: 'synced' });
  } catch (err) {
    store.setState({ syncStatus: 'offline' });
    throw err;
  }
}

async function pushAllocationChanges(prev: Allocation[], next: Allocation[]) {
  const prevById = new Map(prev.map((a) => [a.id, a]));
  const nextIds = new Set(next.map((a) => a.id));
  const changed = next.filter((a) => prevById.get(a.id) !== a);
  const removed = prev.filter((a) => !nextIds.has(a.id));
  if (changed.length === 0 && removed.length === 0) return;

  if (changed.length + removed.length > BULK_THRESHOLD) {
    await publishDataset();
    return;
  }

  store.setState({ syncStatus: 'saving' });
  const now = new Date().toISOString();
  if (changed.length > 0) {
    const { error } = await supabase!
      .from('allocations')
      .upsert(changed.map((a) => ({ id: a.id, data: a, updated_at: now })));
    if (error) throw error;
  }
  if (removed.length > 0) {
    const { error } = await supabase!.from('allocations').delete().in('id', removed.map((a) => a.id));
    if (error) throw error;
  }
  await supabase!.from('change_log').insert([
    ...changed.map((a) => ({
      action: prevById.has(a.id) ? 'update' : 'create',
      allocation_id: a.id,
      before: prevById.get(a.id) || null,
      after: a,
    })),
    ...removed.map((a) => ({ action: 'delete', allocation_id: a.id, before: a, after: null })),
  ]);
  store.setState({ syncStatus: 'synced' });
}

function subscribeToChanges() {
  supabase!
    .channel('timetable')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'allocations' }, (payload) => {
      const { allocations } = store.getState();
      if (payload.eventType === 'DELETE') {
        const id = (payload.old as { id?: string }).id;
        if (id && allocations.some((a) => a.id === id)) {
          applyRemote({ allocations: allocations.filter((a) => a.id !== id) });
        }
        return;
      }
      const incoming = (payload.new as { data: Allocation }).data;
      const index = allocations.findIndex((a) => a.id === incoming.id);
      // Our own writes echo back; skip anything we already have
      if (index !== -1 && JSON.stringify(allocations[index]) === JSON.stringify(incoming)) return;
      const next = allocations.slice();
      if (index === -1) next.push(incoming);
      else next[index] = incoming;
      applyRemote({ allocations: next });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meta' }, (payload) => {
      const version = (payload.new as { value?: { version?: number } })?.value?.version;
      if (version && version !== lastPublishedVersion) {
        store.getState().showToast('Another coordinator published a new timetable – reloading', 'info');
        loadAll();
      }
    })
    .subscribe();
}

let syncQueue: Promise<void> = Promise.resolve();

export function startRemoteSync() {
  if (started) return;
  started = true;

  if (!supabase) {
    store.setState({ syncStatus: 'local', canEdit: true });
    return;
  }

  const applySession = (email: string | null) => store.setState({ authEmail: email, canEdit: !!email });
  supabase.auth.getSession().then(({ data }) => applySession(data.session?.user.email ?? null));
  supabase.auth.onAuthStateChange((_event, session) => applySession(session?.user.email ?? null));

  loadAll();
  subscribeToChanges();

  // Save local edits; queued so writes reach the database in order
  store.subscribe((state, prev) => {
    if (applyingRemote || !state.canEdit || state.syncStatus === 'local') return;
    if (state.syncStatus === 'empty' || state.syncStatus === 'loading') return;
    const datasetReplaced = state.rooms !== prev.rooms || state.courses !== prev.courses || state.students !== prev.students;
    if (!datasetReplaced && state.allocations === prev.allocations) return;

    const before = prev.allocations;
    const after = state.allocations;
    syncQueue = syncQueue
      .then(() => (datasetReplaced ? publishDataset() : pushAllocationChanges(before, after)))
      .catch((err) => {
        console.warn('Could not save to the shared timetable', err);
        store.setState({ syncStatus: 'offline' });
        store.getState().showToast(`Not saved to the database: ${err.message || err}`, 'warning');
      });
  });
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await supabase?.auth.signOut();
}

export const reloadFromDatabase = loadAll;
