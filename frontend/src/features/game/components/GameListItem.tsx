import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ContextMenu } from '@/shared/components/ContextMenu'
import { ChessKing } from '@/shared/components/ChessKing'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { useConfirm } from '@/shared/hooks/useConfirm'
import { useAddGamesToFolder, useCreateFolder, useDeleteGame, useRemoveGamesFromFolder, useUpdateGameNote } from '../api/mutations'
import { useFolders } from '../api/queries'
import { NameDialog } from './NameDialog'
import { TIME_CATEGORY_LABELS } from '../utils/timeCategory'
import { getOwnerOutcome, getResultLabel, type OwnerOutcome } from '../utils/outcome'
import type { AnalysisSummaryResponse, GameResponse, TimeCategory } from '../types/game'

interface GameListItemProps {
  game: GameResponse
  selected?: boolean
  onToggleSelect?: () => void
}

const OUTCOME_STYLES: Record<OwnerOutcome, { text: string; className: string }> = {
  win: { text: '승리', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  loss: { text: '패배', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  draw: { text: '무승부', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
}

// 소유자 없는 게임(PGN 등): 승/패 대신 중립 결과 라벨 + amber 스타일.
function resolveStyle(game: GameResponse): { text: string; className: string } {
  const outcome = getOwnerOutcome(game)
  if (outcome) return OUTCOME_STYLES[outcome]
  return {
    text: getResultLabel(game.result),
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function GameListItem({ game, selected, onToggleSelect }: GameListItemProps) {
  const style = resolveStyle(game)
  const deleteMutation = useDeleteGame()
  const { confirm, dialogProps } = useConfirm()

  // 우클릭 → 폴더에 추가/빼기 (폴더 목록은 메뉴를 열 때만 조회)
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const updateNote = useUpdateGameNote(game.id)
  const closeMenu = useCallback(() => setMenuPosition(null), [])
  const { data: folders } = useFolders({ enabled: menuPosition !== null })
  const addToFolder = useAddGamesToFolder()
  const removeFromFolder = useRemoveGamesFromFolder()
  const createFolder = useCreateFolder()
  const gameFolderIds = new Set((game.folders ?? []).map((f) => f.id))

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
    e.stopPropagation()
  }

  function handleCheckboxChange() {
    onToggleSelect?.()
  }

  return (
    <>
    <Link
      to={`/games/${game.id}`}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenuPosition({ x: e.clientX, y: e.clientY })
      }}
      className={`block rounded-lg border border-amber-200 bg-white px-5 py-4 transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-750`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={selected ?? false}
              onClick={handleCheckbox}
              onChange={handleCheckboxChange}
              className="h-4 w-4 shrink-0 rounded border-amber-300 accent-amber-700"
            />
          )}
          <div className="min-w-0 space-y-1.5 text-left">
            {(game.nickname || game.memo) && (
              <p className="flex items-center gap-2">
                {game.nickname && <span className="font-bold text-amber-900 dark:text-amber-200">{game.nickname}</span>}
                {game.memo && (
                  <span
                    title={game.memo}
                    className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-gray-700 dark:text-amber-300"
                  >
                    ✎ 메모
                  </span>
                )}
              </p>
            )}
            <p className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
              <ChessKing color="white" size={22} />
              {game.white.name}
              {game.white.rating != null && <span className="ml-0.5 text-sm text-gray-500">({game.white.rating})</span>}
              <span className="mx-1 text-amber-400">vs</span>
              <ChessKing color="black" size={22} />
              {game.black.name}
              {game.black.rating != null && <span className="ml-0.5 text-sm text-gray-500">({game.black.rating})</span>}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {game.opening?.name ?? '오프닝 정보 없음'}
              <span className="mx-1.5 text-amber-300">·</span>
              {TIME_CATEGORY_LABELS[game.timeControl.category as TimeCategory] ?? game.timeControl.category}
              <span className="mx-1.5 text-amber-300">·</span>
              {game.totalMoves}수
            </p>
            {/* 분석 요약·폴더 태그는 항상 별도 줄 (길이에 따라 오프닝 줄에 붙었다 떨어졌다 하지 않게) */}
            {(game.analysisSummary || (game.folders ?? []).length > 0) && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                {game.analysisSummary && <AnalysisStats game={game} summary={game.analysisSummary} />}
                {(game.folders ?? []).map((folder) => (
                  <span
                    key={folder.id}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  >
                    <span aria-hidden className="inline-block h-2 w-2.5 rounded-[2px] bg-amber-500" />
                    {folder.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}>
            {style.text}
          </span>
          <span className="whitespace-nowrap text-sm text-gray-400 dark:text-gray-500">
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
    {menuPosition && (
      <ContextMenu
        position={menuPosition}
        onClose={closeMenu}
        items={[
          { label: '게임 이름 변경', onSelect: () => setRenameOpen(true) },
          { type: 'separator' },
          { type: 'heading', label: '폴더에 추가' },
          // 폴더 목록은 메뉴를 열 때 조회 — 도착하면 채워짐
          ...(folders ?? []).map((folder) => {
            const checked = gameFolderIds.has(folder.id)
            return {
              label: folder.name,
              checked,
              onSelect: () =>
                (checked ? removeFromFolder : addToFolder).mutate({ folderId: folder.id, gameIds: [game.id] }),
            }
          }),
          { label: '+ 새 폴더…', onSelect: () => setNewFolderOpen(true) },
        ]}
      />
    )}
    <NameDialog
      open={renameOpen}
      title="게임 이름 변경"
      confirmLabel="저장"
      fieldLabel="게임 이름"
      maxLength={50}
      initialName={game.nickname ?? ''}
      placeholder="예: 첫 퀸 희생 승리"
      hint="목록과 게임 화면 맨 위에 보여요 · 비우고 저장하면 이름을 지워요 · 최대 50자"
      allowEmpty
      isPending={updateNote.isPending}
      // 이름·메모를 함께 저장하는 API라 기존 메모를 같이 보냄
      onSubmit={(name) => updateNote.mutateAsync({ nickname: name, memo: game.memo ?? null })}
      onClose={() => setRenameOpen(false)}
    />
    <NameDialog
      open={newFolderOpen}
      title="새 폴더"
      confirmLabel="만들기"
      isPending={createFolder.isPending}
      onSubmit={(name) => createFolder.mutateAsync({ name, gameIds: [game.id] })}
      onClose={() => setNewFolderOpen(false)}
    />
    </>
  )
}

/** 분석된 게임 표시: "분석됨" 배지 + 내 cp loss·실수 횟수 (소유자 없으면 백/흑 cp loss) */
function AnalysisStats({ game, summary }: { game: GameResponse; summary: AnalysisSummaryResponse }) {
  const owner = game.ownerUsername.trim().toLowerCase()
  const ownerColor = !owner
    ? null
    : game.white.name.toLowerCase() === owner
      ? 'white'
      : game.black.name.toLowerCase() === owner
        ? 'black'
        : null
  const formatAcpl = (acpl: number | null) => (acpl == null ? '-' : String(acpl))

  return (
    <>
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
          분석됨
        </span>
        <span data-testid="analysis-stats" className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          {ownerColor ? (
            <>
              <span>cp loss <b className="tabular-nums text-gray-900 dark:text-gray-100">{formatAcpl(summary[ownerColor].acpl)}</b></span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                Blunder <b className="tabular-nums text-gray-900 dark:text-gray-100">{summary[ownerColor].blunder}</b>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500" />
                Mistake <b className="tabular-nums text-gray-900 dark:text-gray-100">{summary[ownerColor].mistake}</b>
              </span>
            </>
          ) : (
            <span>
              cp loss{' '}
              <b className="tabular-nums text-gray-900 dark:text-gray-100">
                {formatAcpl(summary.white.acpl)} / {formatAcpl(summary.black.acpl)}
              </b>
            </span>
          )}
        </span>
      </span>
    </>
  )
}
