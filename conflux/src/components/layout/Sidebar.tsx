export function Sidebar() {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex h-14 items-center border-b border-zinc-200 px-4 dark:border-zinc-800">
        <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Conflux</span>
      </div>
      <nav className="flex-1 p-4">
        <p className="text-sm text-zinc-500">Navigation coming soon</p>
      </nav>
    </aside>
  );
}
