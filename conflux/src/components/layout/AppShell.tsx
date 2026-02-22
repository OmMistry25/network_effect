import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-auto bg-white p-6 dark:bg-zinc-950">
          {children}
        </main>
      </div>
    </div>
  );
}
