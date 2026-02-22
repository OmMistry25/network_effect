import Link from 'next/link';

const navItems = [
  { href: '/capture/note', label: 'Capture Note' },
  { href: '/people', label: 'People' },
  { href: '/organizations', label: 'Organizations' },
  { href: '/interactions', label: 'Interactions' },
  { href: '/graph', label: 'Graph' },
  { href: '/settings', label: 'Settings' },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex h-14 items-center border-b border-zinc-200 px-4 dark:border-zinc-800">
        <Link href="/dashboard" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Conflux
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
