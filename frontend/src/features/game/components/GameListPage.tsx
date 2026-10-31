import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { useConfirm } from '@/shared/hooks/useConfirm'
import { useGames } from '../api/queries'
import { useDeleteGames, useDeleteAllGames } from '../api/mutations'
import { GameListItem } from './GameListItem'
import { GameFilters } from './GameFilters'
import { EMPTY_FILTERS, hasActiveFilters, type GameFilterValue } from '../utils/gameFilters'

export function GameListPage() {
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState<GameFilterValue>(EMPTY_FILTERS)
  const filtered = hasActiveFilters(filters)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data, isLoading, error, refetch } = useGames({ page, size: 20, ...filters })
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-amber-900 dark:text-amber-100">
          <span className="text-3xl">&#9816;</span> 내 게임
        </h1>
        <Link
          to="/import"
          className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-amber-50 hover:bg-amber-900 dark:bg-amber-700 dark:hover:bg-amber-600"
        >
          게임 가져오기
        </Link>
      </div>

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

      {data && data.content.length === 0 && filtered && (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">
          <p>조건에 맞는 게임이 없습니다.</p>
        </div>
      )}

      {data && data.content.length === 0 && !filtered && (
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
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {isDeleting ? '삭제 중...' : `선택 삭제 (${selectedIds.size})`}
                </button>
              )}
              <button
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
              >
                전체 삭제
              </button>
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

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
