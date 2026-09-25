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
