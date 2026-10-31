import { useParams, Link, useNavigate } from 'react-router-dom'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { useConfirm } from '@/shared/hooks/useConfirm'
import { useGame } from '../api/queries'
import { useDeleteGame, useUpdateAnnotations } from '../api/mutations'
import { useBoardStore } from '../stores/boardStore'
import { getPlayerBadge } from '../utils/outcome'
import { GameViewer } from './GameViewer'
import { GameInfoPanel } from './GameInfoPanel'
import { PlayerBar } from './PlayerBar'
import { GameNicknameHeader } from './GameNote'

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

  const hasMoves = game.moves && game.moves.length > 0

  return (
    <div className="space-y-3">
      <Link to="/games" className="inline-block text-sm text-amber-700 hover:underline dark:text-amber-400">
        &larr; 게임 목록
      </Link>

      <GameNicknameHeader gameId={game.id} nickname={game.nickname} memo={game.memo} />

      {hasMoves ? (
        // 대국자 바·보드·탭(기보·메모 / 경기 정보) — 경기 정보와 삭제는 "경기 정보" 탭에 있음
        <GameViewer
          game={game}
          onSaveAnnotations={handleSaveAnnotations}
          isSaving={annotationMutation.isPending}
          onDelete={handleDelete}
          isDeleting={deleteMutation.isPending}
        />
      ) : (
        // 수가 없는 게임: 보드 없이 대국자와 경기 정보만
        <div className="max-w-xl space-y-3">
          {(['white', 'black'] as const).map((color) => (
            <PlayerBar
              key={color}
              color={color}
              name={game[color].name}
              rating={game[color].rating}
              badge={getPlayerBadge(game, color)}
              stats={null}
            />
          ))}
          <GameInfoPanel game={game} analysis={null} onDelete={handleDelete} isDeleting={deleteMutation.isPending} />
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
