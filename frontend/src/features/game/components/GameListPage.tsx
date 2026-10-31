import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { ContextMenu } from '@/shared/components/ContextMenu'
import { useConfirm } from '@/shared/hooks/useConfirm'
import { useFolders, useGames } from '../api/queries'
import { useAddGamesToFolder, useCreateFolder, useDeleteGames, useDeleteAllGames } from '../api/mutations'
import { GameListItem } from './GameListItem'
import { GameFilters } from './GameFilters'
import { GameLnb } from './GameLnb'
import { FolderNameDialog } from './FolderNameDialog'
import { EMPTY_FILTERS, hasActiveFilters, type GameFilterValue, type LnbSelection } from '../utils/gameFilters'

export function GameListPage() {
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState<GameFilterValue>(EMPTY_FILTERS)
  const [selection, setSelection] = useState<LnbSelection>({ type: 'all' })
  const filtered = hasActiveFilters(filters)
  const scoped = selection.type !== 'all'
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data, isLoading, error, refetch } = useGames({
    page,
    size: 20,
    ...filters,
    folderId: selection.type === 'folder' ? selection.id : undefined,
    opening: selection.type === 'opening' ? selection.name : undefined,
  })
  const deleteGamesMutation = useDeleteGames()
  const deleteAllMutation = useDeleteAllGames()
  const { confirm, dialogProps } = useConfirm()

  const allSelected = data != null && data.content.length > 0 && data.content.every((g) => selectedIds.has(g.id))

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (!data) return
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data.content.map((g) => g.id)))
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return
    const ok = await confirm({
      title: '선택 삭제',
      message: `선택한 ${selectedIds.size}개 게임을 삭제하시겠습니까?`,
      confirmLabel: '삭제',
      variant: 'danger',
    })
    if (!ok) return
    deleteGamesMutation.mutate([...selectedIds], {
      onSuccess: () => setSelectedIds(new Set()),
    })
  }

  async function handleDeleteAll() {
    if (!data || data.totalElements === 0) return
    const ok = await confirm({
      title: '전체 삭제',
      message: `전체 ${data.totalElements}개 게임을 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
      confirmLabel: '전체 삭제',
      variant: 'danger',
    })
    if (!ok) return
    deleteAllMutation.mutate(undefined, {
      onSuccess: () => setSelectedIds(new Set()),
    })
  }

  const isDeleting = deleteGamesMutation.isPending || deleteAllMutation.isPending

  // 선택한 게임 → 폴더에 추가
  const [folderMenu, setFolderMenu] = useState<{ x: number; y: number } | null>(null)
  const [bulkNewFolderOpen, setBulkNewFolderOpen] = useState(false)
  const folderButtonRef = useRef<HTMLButtonElement>(null)
  const closeFolderMenu = useCallback(() => setFolderMenu(null), [])
  const { data: folders } = useFolders({ enabled: folderMenu !== null })
  const addToFolder = useAddGamesToFolder()
  const createFolder = useCreateFolder()
  const selectedIdList = [...selectedIds]

  function handleSelect(next: LnbSelection) {
    setSelection(next)
    setPage(0)
    setSelectedIds(new Set())
  }

  const title = selection.type === 'all' ? '내 게임' : selection.name

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex min-w-0 items-baseline gap-2 text-2xl font-bold text-amber-900 dark:text-amber-100">
          {selection.type === 'all' && <span className="text-3xl">&#9816;</span>}
          <span className="truncate">{title}</span>
          {data && <span className="shrink-0 text-sm font-normal text-gray-500 dark:text-gray-400">{data.totalElements}개</span>}
        </h1>
        <Link
          to="/import"
          className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-amber-50 hover:bg-amber-900 dark:bg-amber-700 dark:hover:bg-amber-600"
        >
          게임 가져오기
        </Link>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="w-full shrink-0 md:sticky md:top-4 md:w-56">
          <GameLnb selection={selection} onSelect={handleSelect} selectedGameIds={selectedIdList} />
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          {/* 필터 */}
          <GameFilters
            value={filters}
            onChange={(next) => {
              setFilters(next)
              setPage(0)
              setSelectedIds(new Set())
            }}
          />

          {filtered && data && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">조건에 맞는 게임 {data.totalElements}개</span>
              <button
                type="button"
                onClick={() => {
                  setFilters(EMPTY_FILTERS)
                  setPage(0)
                }}
                className="font-medium text-amber-700 hover:underline dark:text-amber-400"
              >
                필터 초기화
              </button>
            </div>
          )}

          {/* 게임 목록 */}
          {isLoading && <LoadingSpinner />}

          {error && <ErrorMessage message="게임 목록을 불러오지 못했습니다." onRetry={() => refetch()} />}

          {data && data.content.length === 0 && !filtered && selection.type === 'folder' && (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">
              <p>이 폴더에 아직 게임이 없어요.</p>
              <p className="mt-1 text-sm">목록에서 게임을 우클릭하거나, 여러 개를 선택해 “폴더에 추가”로 넣을 수 있어요.</p>
            </div>
          )}

          {data && data.content.length === 0 && (filtered || selection.type === 'opening') && (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">
              <p>조건에 맞는 게임이 없습니다.</p>
            </div>
          )}

          {data && data.content.length === 0 && !filtered && !scoped && (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">
              <p>아직 가져온 게임이 없습니다.</p>
              <Link to="/import" className="mt-2 inline-block text-indigo-600 hover:underline dark:text-indigo-400">
                게임 가져오기
              </Link>
            </div>
          )}

          {data && data.content.length > 0 && (
            <>
              {/* 선택 삭제 / 전체 삭제 툴바 */}
              <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-amber-300 accent-amber-700"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedIds.size > 0 ? `${selectedIds.size}개 선택` : '전체 선택'}
                  </span>
                </div>
                <div className="flex gap-2">
                  {selectedIds.size > 0 && (
                    <button
                      ref={folderButtonRef}
                      type="button"
                      onClick={() => {
                        const rect = folderButtonRef.current?.getBoundingClientRect()
                        setFolderMenu({ x: rect?.left ?? 0, y: (rect?.bottom ?? 0) + 4 })
                      }}
                      className="rounded border border-amber-400 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-gray-800 dark:text-amber-300 dark:hover:bg-gray-700"
                    >
                      폴더에 추가
                    </button>
                  )}
                  {selectedIds.size > 0 && (
                    <button
                      onClick={handleDeleteSelected}
                      disabled={isDeleting}
                      className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      {isDeleting ? '삭제 중...' : `선택 삭제 (${selectedIds.size})`}
                    </button>
                  )}
                  {/* 전체 삭제는 필터·폴더와 무관하게 모든 게임을 지우므로, "모든 게임"을 필터 없이 볼 때만 노출 */}
                  {!filtered && !scoped && (
                    <button
                      onClick={handleDeleteAll}
                      disabled={isDeleting}
                      className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      전체 삭제
                    </button>
                  )}
                </div>
              </div>

              {/* 게임 목록 */}
              <div className="space-y-2">
                {data.content.map((game) => (
                  <GameListItem
                    key={game.id}
                    game={game}
                    selected={selectedIds.has(game.id)}
                    onToggleSelect={() => toggleSelect(game.id)}
                  />
                ))}
              </div>

              {/* 페이지네이션 */}
              <div className="flex items-center justify-between border-t border-amber-200 pt-4 dark:border-gray-700">
                <p className="text-sm text-amber-700 dark:text-gray-400">
                  전체 {data.totalElements}개 중 {data.page * data.size + 1}-{Math.min((data.page + 1) * data.size, data.totalElements)}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={!data.hasPrevious}
                    className="rounded border border-amber-300 px-3 py-1 text-sm text-amber-800 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                  >
                    이전
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!data.hasNext}
                    className="rounded border border-amber-300 px-3 py-1 text-sm text-amber-800 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                  >
                    다음
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {folderMenu && folders && (
        <ContextMenu
          position={folderMenu}
          title={`${selectedIds.size}개를 폴더에 추가`}
          onClose={closeFolderMenu}
          items={[
            ...folders.map((folder) => ({
              label: folder.name,
              onSelect: () => addToFolder.mutate({ folderId: folder.id, gameIds: selectedIdList }),
            })),
            { label: '+ 새 폴더…', onSelect: () => setBulkNewFolderOpen(true) },
          ]}
        />
      )}
      <FolderNameDialog
        open={bulkNewFolderOpen}
        title="새 폴더"
        confirmLabel="만들기"
        selectedGameCount={selectedIds.size}
        isPending={createFolder.isPending}
        onSubmit={(name, includeSelected) => createFolder.mutateAsync({ name, gameIds: includeSelected ? selectedIdList : [] })}
        onClose={() => setBulkNewFolderOpen(false)}
      />
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
