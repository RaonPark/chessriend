import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { SettingsDialog } from '@/features/settings/components/SettingsDialog'
import { useThemeSync } from '@/features/settings/hooks/useThemeSync'

const NAV_ITEMS = [
  { to: '/games', label: '내 게임' },
  { to: '/import', label: '가져오기' },
]

export function Layout() {
  const location = useLocation()
  useThemeSync()
  // 설정은 페이지 이동 없이 다이얼로그로 (복기 중에도 보드 상태 유지)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-amber-200 bg-amber-900 dark:border-amber-800 dark:bg-gray-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-amber-50">
            <span className="text-2xl">&#9822;</span>
            Chessriend
          </Link>
          <nav className="flex gap-6">
            {NAV_ITEMS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`text-sm font-medium transition ${
                  location.pathname.startsWith(to)
                    ? 'text-amber-200'
                    : 'text-amber-400 hover:text-amber-100'
                }`}
              >
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="text-sm font-medium text-amber-400 transition hover:text-amber-100"
            >
              설정
            </button>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Footer */}
      <footer className="border-t border-amber-200 py-6 text-center text-xs text-amber-700 dark:border-gray-700 dark:text-gray-500">
        Chessriend &mdash; 내 게임이니까 더 애정을 가질 수 있게
      </footer>
    </div>
  )
}
