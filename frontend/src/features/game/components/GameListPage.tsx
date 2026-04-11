import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { useGames } from '../api/queries'
import { GameListItem } from './GameListItem'
import type { GameSource, TimeCategory } from '../types/game'

const TIME_CATEGORIES: TimeCategory[] = [
  'ULTRABULLET', 'BULLET', 'BLITZ', 'RAPID', 'CLASSICAL', 'CORRESPONDENCE',
]

const SOURCES: GameSource[] = ['LICHESS', 'CHESS_COM']

export function GameListPage() {
  const [page, setPage] = useState(0)
  const [source, setSource] = useState<GameSource | undefined>()
  const [timeCategory, setTimeCategory] = useState<TimeCategory | undefined>()

  const { data, isLoading, error, refetch } = useGames({ page, size: 20, source, timeCategory })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">내 게임</h1>
        <Link
          to="/import"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          게임 가져오기
        </Link>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-3">
        <select
          value={source ?? ''}
          onChange={(e) => { setSource(e.target.value as GameSource || undefined); setPage(0) }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="">모든 플랫폼</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s === 'LICHESS' ? 'Lichess' : 'Chess.com'}</option>
          ))}
        </select>
        <select
          value={timeCategory ?? ''}
          onChange={(e) => { setTimeCategory(e.target.value as TimeCategory || undefined); setPage(0) }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="">모든 시간 제한</option>
          {TIME_CATEGORIES.map((tc) => (
            <option key={tc} value={tc}>{tc}</option>
          ))}
        </select>
      </div>

      {/* 게임 목록 */}
      {isLoading && <LoadingSpinner />}

      {error && <ErrorMessage message="게임 목록을 불러오지 못했습니다." onRetry={() => refetch()} />}

      {data && data.content.length === 0 && (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">
          <p>아직 가져온 게임이 없습니다.</p>
          <Link to="/import" className="mt-2 inline-block text-indigo-600 hover:underline dark:text-indigo-400">
            게임 가져오기
          </Link>
        </div>
      )}

      {data && data.content.length > 0 && (
        <>
          <div className="space-y-2">
            {data.content.map((game) => (
              <GameListItem key={game.id} game={game} />
            ))}
          </div>

          {/* 페이지네이션 */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              전체 {data.totalElements}개 중 {data.page * data.size + 1}-{Math.min((data.page + 1) * data.size, data.totalElements)}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={!data.hasPrevious}
                className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
              >
                이전
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!data.hasNext}
                className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
              >
                다음
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
