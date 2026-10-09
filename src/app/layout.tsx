import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Make-Up Class Scheduler | FAST-NUCES Islamabad',
  description:
    'Reschedule classes and plan clash-free make-up sessions for FAST-NUCES Islamabad using the live timetable, rooms and student enrollments.',
  icons: { icon: '/branding/nu-favicon.jpg' },
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
