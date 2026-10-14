import { REQUIRE_SIGN_IN, setEditPin, supabase } from './supabase';
import { useTimetableStore } from '../store/timetableStore';
import { Allocation, CourseSection, Room, Student } from '../types/timetable';

/**
 * Keeps the store in step with the shared Supabase database:
 * loads the dataset on start, saves edits, and applies other browsers' changes live.
 *
 * Edits only ever send the classes that changed. They wait in a queue (kept in this browser)
 * until the database confirms them, so a failed save is retried instead of lost.
 */

type Table = 'rooms' | 'courses' | 'students' | 'allocations';

const PAGE = 1000;
const CHUNK = 500;
/** ids per delete request, keeps the URL short */
const DELETE_CHUNK = 150;
/** Saving more classes than this at once tells other browsers to reload instead of replaying each change */
const BULK_THRESHOLD = 50;
const RETRY_MS = 15_000;
/** A tab hidden longer than this reloads when it comes back, in case live updates were missed */
const STALE_AFTER_HIDDEN_MS = 60_000;
const PENDING_STORAGE_KEY = 'unischedule_pending_changes';
const PIN_STORAGE_KEY = 'unischedule_edit_pin';

let started = false;
/** Set while applying data that came from the database, so it is not written straight back */
let applyingRemote = false;
let lastPublishedVersion: number | null = null;
let syncQueue: Promise<void> = Promise.resolve();
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const store = useTimetableStore;

// ---------------------------------------------------------------------------
// Unsaved changes queue
// ---------------------------------------------------------------------------

interface PendingChange {
  before: Allocation | null;
  /** null = the class was deleted */
  after: Allocation | null;
}

const pending = new Map<string, PendingChange>(readPending());

function readPending(): [string, PendingChange][] {
  try {
    const raw = localStorage.getItem(PENDING_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistPending() {
  try {
    if (pending.size === 0) localStorage.removeItem(PENDING_STORAGE_KEY);
    else localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(Array.from(pending.entries())));
  } catch {
    // Storage full or blocked: changes stay queued in memory for this visit
  }
  store.setState({ pendingChanges: pending.size });
}

/** Queues what changed between two versions of the timetable (unchanged classes keep the same object). */
function queueChanges(prev: Allocation[], next: Allocation[]) {
  const prevById = new Map(prev.map((a) => [a.id, a]));
  const nextIds = new Set(next.map((a) => a.id));
  const queue = (id: string, before: Allocation | null, after: Allocation | null) => {
    const earlier = pending.get(id);
    pending.set(id, { before: earlier ? earlier.before : before, after });
  };
  for (const a of next) {
    const before = prevById.get(a.id);
    if (before !== a) queue(a.id, before || null, a);
  }
  for (const a of prev) if (!nextIds.has(a.id)) queue(a.id, a, null);
  persistPending();
}

/** Applies queued changes on top of data loaded from the database. */
function withPending(allocations: Allocation[]): Allocation[] {
  if (pending.size === 0) return allocations;
  const byId = new Map(allocations.map((a) => [a.id, a]));
  pending.forEach(({ after }, id) => {
    if (after) byId.set(id, after);
    else byId.delete(id);
  });
  return Array.from(byId.values());
}

async function flushPending(): Promise<void> {
  if (!supabase || pending.size === 0 || !store.getState().canEdit) return;
  const batch = Array.from(pending.entries());
  const now = new Date().toISOString();
  store.setState({ syncStatus: 'saving' });

  const upserts = batch.filter(([, p]) => p.after).map(([id, p]) => ({ id, data: p.after, updated_at: now }));
  const deletes = batch.filter(([, p]) => !p.after).map(([id]) => id);
  for (let i = 0; i < upserts.length; i += CHUNK) {
    const { error } = await supabase.from('allocations').upsert(upserts.slice(i, i + CHUNK));
    if (error) throw error;
  }
  for (let i = 0; i < deletes.length; i += DELETE_CHUNK) {
    const { error } = await supabase.from('allocations').delete().in('id', deletes.slice(i, i + DELETE_CHUNK));
    if (error) throw error;
  }

  // Saved: drop from the queue unless the class was edited again meanwhile
  for (const [id, change] of batch) if (pending.get(id) === change) pending.delete(id);
  persistPending();

  const log = batch.map(([id, p]) => ({
    action: !p.after ? 'delete' : p.before ? 'update' : 'create',
    allocation_id: id,
    before: p.before,
    after: p.after,
  }));
  for (let i = 0; i < log.length; i += CHUNK) {
    const { error } = await supabase.from('change_log').insert(log.slice(i, i + CHUNK));
    if (error) console.warn('Change saved, but the change log entry failed', error);
  }
  if (batch.length > BULK_THRESHOLD) await bumpDatasetVersion();

  store.setState({ syncStatus: pending.size > 0 ? 'saving' : 'synced' });
  if (pending.size > 0) scheduleFlush();
}

/** Runs a database write after earlier ones; on failure keeps the queue and retries later. */
function enqueue(task: () => Promise<void>) {
  syncQueue = syncQueue.then(task).catch((err) => {
    console.warn('Could not save to the shared timetable', err);
    store.setState({ syncStatus: 'offline' });
    store
      .getState()
      .showToast(`Not saved yet – will retry automatically (${err?.message || err})`, 'warning');
    scheduleRetry();
  });
  return syncQueue;
}

const scheduleFlush = () => enqueue(flushPending);

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    scheduleFlush();
  }, RETRY_MS);
}

// ---------------------------------------------------------------------------
// Loading and full replacement
// ---------------------------------------------------------------------------

async function fetchAll<T>(table: Table): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!.from(table).select('data').order('id').range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []).map((r) => r.data as T));
    if (!data || data.length < PAGE) return rows;
  }
}

let loading: Promise<void> | null = null;

/** Reloads everything from the database; unsaved local changes are kept on top and retried. */
function loadAll(): Promise<void> {
  if (!loading) loading = doLoadAll().finally(() => (loading = null));
  return loading;
}

async function doLoadAll() {
  store.setState({ syncStatus: 'loading' });
  try {
    const [rooms, courses, students, allocations] = await Promise.all([
      fetchAll<Room>('rooms'),
      fetchAll<CourseSection>('courses'),
      fetchAll<Student>('students'),
      fetchAll<Allocation>('allocations'),
    ]);
    if (allocations.length === 0 || rooms.length === 0) {
      // Nothing published yet: keep the bundled timetable until someone publishes it
      store.setState({ syncStatus: 'empty' });
      return;
    }
    const { selectedRoomId } = store.getState();
    applyRemote({ rooms, courses, students, allocations: withPending(allocations) });
    if (!rooms.some((r) => r.id === selectedRoomId)) store.setState({ selectedRoomId: rooms[0].id });
    store.setState({ syncStatus: 'synced' });
    if (pending.size > 0) scheduleFlush();
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

/**
 * Makes a table match `items`: upserts every row, then deletes only rows that are gone.
 * Never empties the table first, so the live events other browsers receive (some of which the
 * realtime service may drop under load) always describe the final state.
 */
async function syncTable(table: Table, items: { id: string }[]) {
  const now = new Date().toISOString();
  for (let i = 0; i < items.length; i += CHUNK) {
    const { error } = await supabase!
      .from(table)
      .upsert(items.slice(i, i + CHUNK).map((item) => ({ id: item.id, data: item, updated_at: now })));
    if (error) throw error;
  }

  const keep = new Set(items.map((item) => item.id));
  const stale: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!.from(table).select('id').order('id').range(from, from + PAGE - 1);
    if (error) throw error;
    for (const row of data || []) if (!keep.has(row.id)) stale.push(row.id);
    if (!data || data.length < PAGE) break;
  }
  for (let i = 0; i < stale.length; i += DELETE_CHUNK) {
    const { error } = await supabase!.from(table).delete().in('id', stale.slice(i, i + DELETE_CHUNK));
    if (error) throw error;
  }
}

/** Tells other open browsers to reload (they would otherwise replay a flood of single changes). */
async function bumpDatasetVersion() {
  const version = Date.now();
  lastPublishedVersion = version;
  const { error } = await supabase!
    .from('meta')
    .upsert({ key: 'dataset', value: { version }, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/**
 * Replaces the whole shared dataset with what this browser has now.
 * Only for the explicit "Publish" button – it would overwrite other people's changes.
 */
export async function publishDataset(): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { rooms, courses, students, allocations } = store.getState();
  store.setState({ syncStatus: 'saving' });
  try {
    await syncTable('rooms', rooms);
    await syncTable('courses', courses);
    await syncTable('students', students);
    await syncTable('allocations', allocations);
    pending.clear();
    persistPending();
    await bumpDatasetVersion();
    await supabase
      .from('change_log')
      .insert({ action: 'publish dataset', after: { allocations: allocations.length, students: students.length } });
    store.setState({ syncStatus: 'synced' });
  } catch (err) {
    store.setState({ syncStatus: 'offline' });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Live updates
// ---------------------------------------------------------------------------

function applyRemote(update: Partial<Pick<ReturnType<typeof store.getState>, Table>>) {
  applyingRemote = true;
  try {
    store.setState(update);
  } finally {
    applyingRemote = false;
  }
}

function subscribeToChanges() {
  let connectedBefore = false;
  supabase!
    .channel('timetable')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'allocations' }, (payload) => {
      const id =
        payload.eventType === 'DELETE'
          ? (payload.old as { id?: string }).id
          : (payload.new as { data: Allocation }).data?.id;
      // Our own unsaved edit is newer than anything echoed back
      if (!id || pending.has(id)) return;
      const { allocations } = store.getState();
      if (payload.eventType === 'DELETE') {
        if (allocations.some((a) => a.id === id)) applyRemote({ allocations: allocations.filter((a) => a.id !== id) });
        return;
      }
      const incoming = (payload.new as { data: Allocation }).data;
      const index = allocations.findIndex((a) => a.id === id);
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
        store.getState().showToast('The shared timetable changed in bulk – reloading', 'info');
        loadAll();
      }
    })
    .subscribe((status) => {
      // After a dropped connection, changes made meanwhile were never delivered: reload once reconnected
      if (status === 'SUBSCRIBED') {
        if (connectedBefore) loadAll();
        connectedBefore = true;
      }
    });
}

function watchForMissedUpdates() {
  let hiddenSince: number | null = null;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenSince = Date.now();
    } else if (hiddenSince && Date.now() - hiddenSince > STALE_AFTER_HIDDEN_MS) {
      hiddenSince = null;
      loadAll();
    }
  });
  window.addEventListener('online', () => {
    loadAll();
  });
}

// ---------------------------------------------------------------------------
// Start-up
// ---------------------------------------------------------------------------

export function startRemoteSync() {
  if (started) return;
  started = true;

  if (!supabase) {
    store.setState({ syncStatus: 'local', canEdit: true });
    return;
  }
  store.setState({ pendingChanges: pending.size });

  const applySession = (email: string | null) => {
    store.setState({ authEmail: email });
    if (REQUIRE_SIGN_IN) store.setState({ canEdit: !!email });
  };
  if (!REQUIRE_SIGN_IN) {
    // Re-check a PIN this browser remembered; it may have been changed since
    const saved = readSavedPin();
    if (saved) unlockWithPin(saved).catch(() => forgetPin());
  }
  supabase.auth.getSession().then(({ data }) => applySession(data.session?.user.email ?? null));
  supabase.auth.onAuthStateChange((_event, session) => applySession(session?.user.email ?? null));

  loadAll();
  subscribeToChanges();
  watchForMissedUpdates();

  // Save local edits: only what changed, in order
  store.subscribe((state, prev) => {
    if (applyingRemote || !state.canEdit || state.syncStatus === 'local' || state.syncStatus === 'empty') return;
    const changedTables = (['rooms', 'courses', 'students'] as const).filter((t) => state[t] !== prev[t]);
    if (changedTables.length === 0 && state.allocations === prev.allocations) return;

    if (state.allocations !== prev.allocations) queueChanges(prev.allocations, state.allocations);
    if (changedTables.length > 0) {
      // A CSV import replaced rooms, courses or students: send those tables, then the class changes
      enqueue(async () => {
        store.setState({ syncStatus: 'saving' });
        for (const table of changedTables) await syncTable(table, store.getState()[table]);
        await bumpDatasetVersion();
        await flushPending();
      });
    } else {
      scheduleFlush();
    }
  });
}

// ---------------------------------------------------------------------------
// Edit access
// ---------------------------------------------------------------------------

function readSavedPin(): string | null {
  try {
    return localStorage.getItem(PIN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function forgetPin() {
  setEditPin(null);
  try {
    localStorage.removeItem(PIN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Checks the PIN with the database; on success this browser can edit until locked again. */
export async function unlockWithPin(pin: string) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.rpc('check_edit_pin', { pin });
  if (error) throw error;
  if (!data) throw new Error('Wrong PIN');
  setEditPin(pin);
  try {
    localStorage.setItem(PIN_STORAGE_KEY, pin);
  } catch {
    // ignore: unlocked for this visit only
  }
  store.setState({ canEdit: true });
  // Changes queued while locked can go now
  if (pending.size > 0) scheduleFlush();
}

export function lockEditing() {
  forgetPin();
  store.setState({ canEdit: false });
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
