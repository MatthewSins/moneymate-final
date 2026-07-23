
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Header } from '@/components/dashboard/Header';
import { CommandPalette } from '@/components/dashboard/CommandPalette';

export default function DashboardLayout() {
  const [commandOpen, setCommandOpen] = React.useState(false);
  return (
    <div className="flex min-h-screen w-full flex-col relative overflow-hidden bg-background transition-colors duration-500 text-foreground">
      <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br dark:from-zinc-900 dark:via-black dark:to-zinc-900 from-slate-50 via-white to-slate-50" />
        <div className="absolute -top-[25%] -left-[10%] w-[70%] h-[70%] rounded-full dark:bg-slate-400/10 bg-primary/5 blur-[120px] dark:mix-blend-screen" />
        <div className="absolute top-[40%] -right-[20%] w-[60%] h-[80%] rounded-full dark:bg-zinc-600/10 bg-blue-500/5 blur-[150px] dark:mix-blend-screen" />
      </div>
      <div className="flex h-screen overflow-hidden">
        <aside className="hidden md:block w-72 shrink-0 border-r">
          <Sidebar />
        </aside>
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header onSearchClick={() => setCommandOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 flex flex-col">
            <div className="flex-1">
              <Outlet />
            </div>
            <footer className="py-6 mt-8 text-center text-muted-foreground text-sm">
              <p>Made with ❤️ by X</p>
            </footer>
          </main>
        </div>
      </div>
      <CommandPalette open={commandOpen} setOpen={setCommandOpen} />
    </div>
  );
}
