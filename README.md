# UniSchedule Pro (Class-Reschedule)

> Enterprise University Timetable Rescheduling & Conflict Resolution Web Application for FAST-NUCES.

UniSchedule Pro is a specialized Next.js 14 web application designed for academic coordinators and timetable administrators. It provides real-time, minute-level conflict prevention when rescheduling lectures, scheduling makeup sessions, or finding vacant campus rooms.

---

## 🚀 Key Features

- **Deterministic Minute-Level Conflict Engine:** Mathematical open-interval collision detection preventing room double-booking and student cross-enrollment clashes in sub-millisecond time.
- **Adaptive Timetable Grid:**
  - Dynamic time-slot awareness for standard theory classes (Slots 1–6) and combined lab sessions (Slots 9–12, ~3-hour blocks).
  - Synchronized top & bottom horizontal scrolling with quick-pan navigation buttons (`◀` / `▶`).
  - Sticky time slot column and header row for large campus matrices.
  - Room categorization tabs: All (78), Block C (28), Block D (32), and Specialized Labs (18).
- **Quick Reschedule & Vacant Room Scanner:**
  - Real-time campus room scanner that checks 100% vacancy and cross-enrollment clashes across all 78 campus rooms.
  - 1-click room reassignment.
- **Weekly Rescheduled Classes Review & Keep/Revert System:**
  - Visual Before/After diff cards for all modified sessions.
  - Individual "Keep for Week" (locks changes) and "Revert" (restores baseline slot/room).
  - Bulk "Keep All for Current Week" and "Revert All Changes" with confirmation safeguards.
- **Flexible Makeup Class Allocator:** Discover arbitrary open duration windows (60m, 90m, 120m) for makeup lectures.
- **Student Roster Impact Analysis:** Detailed clash breakdown showing exact student roll numbers and enrolled sections affected by potential changes.
- **Full Dataset Ingestion:** Built-in support for official FAST-NUCES campus timetables, room directories, and student enrollment records.

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 14 (App Router)](https://nextjs.org/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand)
- **Database (Optional/Production):** PostgreSQL / Supabase Realtime

---

## 💻 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/ShaharyarYousaf/Class-Reschedule.git
cd Class-Reschedule
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for production
```bash
npm run build
npm start
```

---

## 📅 Updating the Built-in Timetable

Every visitor starts with the dataset bundled in `data/`, so nobody has to import CSVs themselves.

1. Replace the CSVs in `Fall 2026/` (courses, rooms, `timetable_with_custom_times.csv`, student enrollments).
   In the timetable, leave **Start Time / End Time** blank for regular classes and fill both for classes that don't match their slot (e.g. `13:00`, `14:45`).
2. Run `npm run build:data` and check the import report it prints.
3. Commit the changed files in `data/` and push to `main`. Vercel redeploys automatically.

Browsers that cached an older timetable switch to the new one on their next visit. Reschedules made in a browser stay on that device only.

---

## 🗄️ Shared Database (Supabase)

With Supabase configured, everyone sees the same timetable and coordinators' changes appear live in every open browser. Without it, the app runs on the bundled data and changes stay in each browser.

1. In Supabase → **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql).
2. In the same editor, set the edit PIN (replace `0000`; the PIN is stored only as a hash):
   ```sql
   insert into private.edit_pin (id, pin_hash) values (1, extensions.crypt('0000', extensions.gen_salt('bf')))
   on conflict (id) do update set pin_hash = excluded.pin_hash;
   ```
   Run it again with a new PIN to change it.
3. Put the project URL and publishable/anon key in `.env.local` (see `.env.example`) and in Vercel's environment variables.
4. Open the app, click **Enter PIN**, then **Publish this browser's timetable to everyone** once to fill the database.

**Edit PIN (current):** anyone can view; rescheduling, make-ups, deletes and imports need the PIN. The database checks it on every write, so it can't be bypassed with the public key. A browser remembers the PIN until **Lock** is clicked. Wrong guesses are limited to 20 per 15 minutes. Every change is recorded in the `change_log` table.

**Coordinator accounts later:** run [`supabase/require-sign-in.sql`](supabase/require-sign-in.sql), add users in **Authentication → Users**, turn off public sign-ups, and set `NEXT_PUBLIC_REQUIRE_SIGN_IN=true` locally and in Vercel.
