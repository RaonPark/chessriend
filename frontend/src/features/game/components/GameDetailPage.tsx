import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChessKing } from '@/shared/components/ChessKing'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { useConfirm } from '@/shared/hooks/useConfirm'
import { useGame } from '../api/queries'
import { useDeleteGame, useUpdateAnnotations } from '../api/mutations'
import { useBoardStore } from '../stores/boardStore'
import { getOwnerOutcome, getResultLabel, type OwnerOutcome } from '../utils/outcome'
import { GameViewer } from './GameViewer'
import type { GameSource } from '../types/game'

const SOURCE_LABELS: Record<GameSource, string> = {
  CHESS_COM: 'Chess.com',
  LICHESS: 'lichess',
  PGN: 'PGN',
}

const OUTCOME_LABELS: Record<OwnerOutcome, { text: string; className: string }> = {
  win: { text: '승리', className: 'text-green-600 dark:text-green-400' },
  loss: { text: '패배', className: 'text-red-600 dark:text-red-400' },
  draw: { text: '무승부', className: 'text-gray-600 dark:text-gray-400' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function GameDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: game, isLoading, error, refetch } = useGame(id!)
  const deleteMutation = useDeleteGame()
  const annotationMutation = useUpdateAnnotations(id!)
  const getAnnotationsSnapshot = useBoardStore((s) => s.getAnnotationsSnapshot)
  const markAnnotationsClean = useBoardStore((s) => s.markAnnotationsClean)
  const { confirm, dialogProps } = useConfirm()

  function handleSaveAnnotations() {
    const snapshot = getAnnotationsSnapshot()
    annotationMutation.mutate(snapshot, {
      onSuccess: () => markAnnotationsClean(),
    })
  }

  async function handleDelete() {
    const ok = await confirm({
      title: '게임 삭제',
      message: '이 게임을 삭제하시겠습니까?',
      confirmLabel: '삭제',
      variant: 'danger',
    })
    if (!ok) return
    deleteMutation.mutate(id!, {
      onSuccess: () => navigate('/games'),
    })
  }

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message="게임 정보를 불러오지 못했습니다." onRetry={() => refetch()} />
  if (!game) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/games" className="text-sm text-amber-700 hover:underline dark:text-amber-400">
          &larr; 게임 목록
        </Link>
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
        >
          {deleteMutation.isPending ? '삭제 중...' : '게임 삭제'}
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {/* 대국자 정보 */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4 text-lg sm:gap-10">
          <div className="flex flex-col items-center text-center">
            <ChessKing color="white" size={56} />
            <p className="mt-2 font-semibold text-gray-900 dark:text-gray-100">{game.white.name}</p>
            {game.white.rating != null && (
              <p className="text-sm text-amber-700 dark:text-amber-400">{game.white.rating}</p>
            )}
          </div>
          <span className="pt-16 text-2xl font-light text-amber-400">vs</span>
          <div className="flex flex-col items-center text-center">
            <ChessKing color="black" size={56} />
            <p className="mt-2 font-semibold text-gray-900 dark:text-gray-100">{game.black.name}</p>
            {game.black.rating != null && (
              <p className="text-sm text-amber-700 dark:text-amber-400">{game.black.rating}</p>
            )}
          </div>
        </div>

        {/* 결과 */}
        {(() => {
          const outcome = getOwnerOutcome(game)
          if (outcome) {
            const label = OUTCOME_LABELS[outcome]
            return (
              <p className={`mt-4 text-center text-lg font-semibold ${label.className}`}>
                {label.text} ({game.result})
              </p>
            )
          }
          // 소유자 없는 게임(PGN 등) → 중립 결과 라벨
          return (
            <p className="mt-4 text-center text-lg font-semibold text-gray-600 dark:text-gray-400">
              {getResultLabel(game.result)} ({game.result})
            </p>
          )
        })()}

        {/* 메타 정보 */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-amber-100 pt-4 text-sm dark:border-gray-700 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <p className="text-amber-600 dark:text-amber-500">플랫폼</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">{SOURCE_LABELS[game.source]}</p>
          </div>
          <div>
            <p className="text-amber-600 dark:text-amber-500">시간 제한</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {game.timeControl.time} ({game.timeControl.category})
            </p>
          </div>
          <div>
            <p className="text-amber-600 dark:text-amber-500">오프닝</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {game.opening ? `${game.opening.name}${game.opening.eco ? ` (${game.opening.eco})` : ''}` : '-'}
            </p>
          </div>
          <div>
            <p className="text-amber-600 dark:text-amber-500">총 수</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">{game.totalMoves}수</p>
          </div>
          <div>
            <p className="text-amber-600 dark:text-amber-500">대국 날짜</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(game.playedAt)}</p>
          </div>
        </div>
      </div>

      {/* 체스보드 뷰어 */}
      {game.moves && game.moves.length > 0 && (
        <GameViewer
          gameId={id!}
          moves={game.moves}
          annotations={game.annotations}
          ownerUsername={game.ownerUsername}
          whiteName={game.white.name}
          blackName={game.black.name}
          onSaveAnnotations={handleSaveAnnotations}
          isSaving={annotationMutation.isPending}
        />
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
