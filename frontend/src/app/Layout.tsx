import { Link, Outlet, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/games', label: '내 게임' },
  { to: '/import', label: '가져오기' },
]

export function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Chessriend
          </Link>
          <nav className="flex gap-4">
            {NAV_ITEMS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`text-sm font-medium transition ${
                  location.pathname.startsWith(to)
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
