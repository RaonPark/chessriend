import { Link } from 'react-router-dom'
import type { GameResponse } from '../types/game'

interface GameListItemProps {
  game: GameResponse
}

function resultLabel(result: string) {
  switch (result) {
    case '1-0': return { text: '백 승', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' }
    case '0-1': return { text: '흑 승', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' }
    case '1/2-1/2': return { text: '무승부', className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' }
    default: return { text: result, className: 'bg-gray-100 text-gray-700' }
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function GameListItem({ game }: GameListItemProps) {
  const result = resultLabel(game.result)

  return (
    <Link
      to={`/games/${game.id}`}
      className="block rounded-lg border border-gray-200 p-4 transition hover:border-indigo-300 hover:shadow-sm dark:border-gray-700 dark:hover:border-indigo-600"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-left">
            <p className="font-medium text-gray-900 dark:text-gray-100">
              <span className="text-xs text-gray-400">[백]</span>{' '}
              {game.white.name}
              {game.white.rating != null && <span className="ml-1 text-sm text-gray-500">({game.white.rating})</span>}
              <span className="mx-2 text-gray-400">vs</span>
              <span className="text-xs text-gray-400">[흑]</span>{' '}
              {game.black.name}
              {game.black.rating != null && <span className="ml-1 text-sm text-gray-500">({game.black.rating})</span>}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {game.opening?.name ?? '오프닝 정보 없음'}
              <span className="mx-1.5">·</span>
              {game.timeControl.category}
              <span className="mx-1.5">·</span>
              {game.totalMoves}수
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${result.className}`}>
            {result.text}
          </span>
          <span className="text-sm text-gray-400 dark:text-gray-500">
            {formatDate(game.playedAt)}
          </span>
        </div>
      </div>
    </Link>
  )
}
