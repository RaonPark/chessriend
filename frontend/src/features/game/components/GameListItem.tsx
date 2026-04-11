import { Link } from 'react-router-dom'
import { ChessKing } from '@/shared/components/ChessKing'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { useConfirm } from '@/shared/hooks/useConfirm'
import { useDeleteGame } from '../api/mutations'
import type { GameResponse } from '../types/game'

interface GameListItemProps {
  game: GameResponse
  selected?: boolean
  onToggleSelect?: () => void
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

const OUTCOME_STYLES: Record<Outcome, { text: string; className: string; border: string }> = {
  win: { text: '승리', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', border: 'border-l-green-500' },
  loss: { text: '패배', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', border: 'border-l-red-500' },
  draw: { text: '무승부', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200', border: 'border-l-amber-500' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function GameListItem({ game, selected, onToggleSelect }: GameListItemProps) {
  const outcome = getOutcome(game)
  const style = OUTCOME_STYLES[outcome]
  const deleteMutation = useDeleteGame()
  const { confirm, dialogProps } = useConfirm()

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    const ok = await confirm({
      title: '게임 삭제',
      message: `${game.white.name} vs ${game.black.name} 게임을 삭제하시겠습니까?`,
      confirmLabel: '삭제',
      variant: 'danger',
    })
    if (!ok) return
    deleteMutation.mutate(game.id)
  }

  function handleCheckbox(e: React.MouseEvent) {
    e.preventDefault()
    onToggleSelect?.()
  }

  return (
    <>
    <Link
      to={`/games/${game.id}`}
      className={`block rounded-lg border border-amber-200 border-l-4 ${style.border} bg-white p-4 transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-750`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={selected ?? false}
              onClick={handleCheckbox}
              readOnly
              className="h-4 w-4 shrink-0 rounded border-amber-300 accent-amber-700"
            />
          )}
          <div className="text-left">
            <p className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
              <ChessKing color="white" size={22} />
              {game.white.name}
              {game.white.rating != null && <span className="ml-0.5 text-sm text-gray-500">({game.white.rating})</span>}
              <span className="mx-1 text-amber-400">vs</span>
              <ChessKing color="black" size={22} />
              {game.black.name}
              {game.black.rating != null && <span className="ml-0.5 text-sm text-gray-500">({game.black.rating})</span>}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {game.opening?.name ?? '오프닝 정보 없음'}
              <span className="mx-1.5 text-amber-300">·</span>
              {game.timeControl.category}
              <span className="mx-1.5 text-amber-300">·</span>
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
    <ConfirmDialog {...dialogProps} />
    </>
  )
}
