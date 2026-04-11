import { Link } from 'react-router-dom'
import { useDeleteGame } from '../api/mutations'
import type { GameResponse } from '../types/game'

interface GameListItemProps {
  game: GameResponse
}

type Outcome = 'win' | 'loss' | 'draw'

function getOutcome(game: GameResponse): Outcome {
  const owner = game.ownerUsername.toLowerCase()
  const isWhite = game.white.name.toLowerCase() === owner
  const isBlack = game.black.name.toLowerCase() === owner

  if (game.result === '1/2-1/2') return 'draw'
  if (game.result === '1-0') return isWhite ? 'win' : isBlack ? 'loss' : 'draw'
  if (game.result === '0-1') return isBlack ? 'win' : isWhite ? 'loss' : 'draw'
  return 'draw'
}

const OUTCOME_STYLES: Record<Outcome, { text: string; className: string }> = {
  win: { text: '승리', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  loss: { text: '패배', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  draw: { text: '무승부', className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function GameListItem({ game }: GameListItemProps) {
  const outcome = getOutcome(game)
  const style = OUTCOME_STYLES[outcome]
  const deleteMutation = useDeleteGame()

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault() // Link 클릭 방지
    if (!confirm('이 게임을 삭제하시겠습니까?')) return
    deleteMutation.mutate(game.id)
  }

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
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}>
            {style.text}
          </span>
          <span className="text-sm text-gray-400 dark:text-gray-500">
            {formatDate(game.playedAt)}
          </span>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950 dark:hover:text-red-400"
            title="삭제"
          >
            &times;
          </button>
        </div>
      </div>
    </Link>
  )
}
