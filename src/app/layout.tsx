import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UniSchedule Pro - University Timetable Rescheduler & Clash Guard',
  description: 'Interactive university timetable management and slot conflict resolution application.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col">
        {children}
      </body>
    </html>
  );
}
