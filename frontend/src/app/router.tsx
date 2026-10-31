import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Layout } from './Layout'
import { GameListPage } from '@/features/game/components/GameListPage'
import { GameDetailPage } from '@/features/game/components/GameDetailPage'
import { ImportPage } from '@/features/game/components/ImportPage'
import { SettingsPage } from '@/features/settings/components/SettingsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/games" replace /> },
      { path: 'games', element: <GameListPage /> },
      { path: 'games/:id', element: <GameDetailPage /> },
      { path: 'import', element: <ImportPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
