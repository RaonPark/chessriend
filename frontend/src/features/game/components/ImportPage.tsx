import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { Dropdown } from '@/shared/components/Dropdown'
import { useConfirm } from '@/shared/hooks/useConfirm'
import { useGameImport } from '../hooks/useGameImport'
import { GameListItem } from './GameListItem'
import type { GameSource } from '../types/game'

const PLATFORMS: { value: GameSource; name: string; description: string; placeholder: string; help: string }[] = [
  {
    value: 'LICHESS',
    name: 'Lichess',
    description: '무료 오픈소스 체스 서버',
    placeholder: 'lichess.org 닉네임',
    help: 'lichess.org/@/닉네임 에서 확인할 수 있습니다',
  },
  {
    value: 'CHESS_COM',
    name: 'Chess.com',
    description: '세계 최대 체스 플랫폼',
    placeholder: 'chess.com 닉네임',
    help: 'chess.com/member/닉네임 에서 확인할 수 있습니다',
  },
]

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: currentYear - 2010 + 1 }, (_, i) => currentYear - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}월`,
}))

const MAX_OPTIONS = [
  { value: 10, label: '최근 10경기' },
  { value: 50, label: '최근 50경기' },
  { value: 100, label: '최근 100경기' },
  { value: 200, label: '최근 200경기' },
]

export function ImportPage() {
  const [source, setSource] = useState<GameSource>('LICHESS')
  const [username, setUsername] = useState('')
  const [max, setMax] = useState(50)
  const [sinceYear, setSinceYear] = useState('')
  const [sinceMonth, setSinceMonth] = useState('')
  const [untilYear, setUntilYear] = useState('')
  const [untilMonth, setUntilMonth] = useState('')
  const [showDateFilter, setShowDateFilter] = useState(false)

  const { isImporting, importedGames, error, startImport, cancelImport } = useGameImport()
  const { confirm, dialogProps } = useConfirm()

  const platform = PLATFORMS.find((p) => p.value === source)!

  function buildDate(year: string, month: string, isEnd: boolean): string | undefined {
    if (!year) return undefined
    const y = parseInt(year)
    const m = month ? parseInt(month) : (isEnd ? 12 : 1)
    if (isEnd) {
      // 해당 월의 마지막 날
      const lastDay = new Date(y, m, 0).getDate()
      return new Date(y, m - 1, lastDay, 23, 59, 59).toISOString()
    }
    return new Date(y, m - 1, 1).toISOString()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim()) return

    const sinceDate = buildDate(sinceYear, sinceMonth, false)
    const untilDate = buildDate(untilYear, untilMonth, true)

    if (sinceDate && untilDate && new Date(sinceDate) > new Date(untilDate)) {
      await confirm({ title: '날짜 오류', message: '시작 시점이 종료 시점보다 뒤에 있습니다.', confirmLabel: '확인' })
      return
    }

    startImport({
      source,
      username: username.trim(),
      max,
      since: sinceDate,
      until: untilDate,
    })
  }

  return (
    <div className="space-y-6">
      <Link to="/games" className="text-sm text-amber-700 hover:underline dark:text-amber-400">
        &larr; 게임 목록
      </Link>

      <h1 className="flex items-center gap-2 text-2xl font-bold text-amber-900 dark:text-amber-100">
        <span className="text-3xl">&#9823;</span> 게임 가져오기
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-amber-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {/* 플랫폼 카드 선택 */}
        <div>
          <label className="mb-3 block text-sm font-medium text-amber-800 dark:text-amber-300">플랫폼 선택</label>
          <div className="grid grid-cols-2 gap-3">
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                type="button"
                disabled={isImporting}
                onClick={() => setSource(p.value)}
                className={`rounded-xl border-2 p-4 text-left transition ${
                  source === p.value
                    ? 'border-amber-600 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/30'
                    : 'border-amber-200 bg-white hover:border-amber-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500'
                } disabled:opacity-60`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-gray-900 dark:text-gray-100">{p.name}</span>
                  {source === p.value && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-xs text-white">&#10003;</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{p.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 사용자명 */}
        <div>
          <label className="block text-sm font-medium text-amber-800 dark:text-amber-300">
            {platform.name} 닉네임
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isImporting}
            placeholder={platform.placeholder}
            className="mt-1 w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-base dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            {platform.help}
          </p>
        </div>

        {/* 최대 게임 수 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-amber-800 dark:text-amber-300">가져올 경기 수</label>
          <div className="flex flex-wrap gap-2">
            {MAX_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={isImporting}
                onClick={() => setMax(opt.value)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  max === opt.value
                    ? 'border-amber-600 bg-amber-800 text-amber-50 dark:bg-amber-700'
                    : 'border-amber-200 bg-white text-amber-800 hover:bg-amber-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                } disabled:opacity-60`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            최신 경기부터 가져옵니다. 이미 가져온 경기는 자동으로 건너뜁니다.
          </p>
        </div>

        {/* 기간 필터 (접힘) */}
        <div>
          <button
            type="button"
            onClick={() => setShowDateFilter(!showDateFilter)}
            className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
          >
            <span className={`inline-block transition ${showDateFilter ? 'rotate-90' : ''}`}>&#9654;</span>
            기간 지정 (선택사항)
          </button>

          {showDateFilter && (
            <div className="mt-3 space-y-4 rounded-lg border border-amber-100 bg-amber-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
              <div className="grid grid-cols-2 gap-4">
                {/* 시작 시점 */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-amber-700 dark:text-amber-400">시작</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Dropdown
                        value={sinceYear}
                        placeholder="년도"
                        disabled={isImporting}
                        options={YEARS.map((y) => ({ value: String(y), label: `${y}년` }))}
                        onChange={setSinceYear}
                      />
                    </div>
                    <div className="flex-1">
                      <Dropdown
                        value={sinceMonth}
                        placeholder="전체"
                        disabled={isImporting || !sinceYear}
                        options={MONTHS}
                        onChange={setSinceMonth}
                      />
                    </div>
                  </div>
                </div>
                {/* 종료 시점 */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-amber-700 dark:text-amber-400">종료</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Dropdown
                        value={untilYear}
                        placeholder="년도"
                        disabled={isImporting}
                        options={YEARS.map((y) => ({ value: String(y), label: `${y}년` }))}
                        onChange={setUntilYear}
                      />
                    </div>
                    <div className="flex-1">
                      <Dropdown
                        value={untilMonth}
                        placeholder="전체"
                        disabled={isImporting || !untilYear}
                        options={MONTHS}
                        onChange={setUntilMonth}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                예: 2024년 1월 ~ 2024년 12월 게임만 가져오기. 월을 선택하지 않으면 해당 연도 전체.
              </p>
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          {!isImporting ? (
            <button
              type="submit"
              disabled={!username.trim()}
              className="rounded-lg bg-amber-800 px-6 py-2.5 text-sm font-medium text-amber-50 hover:bg-amber-900 disabled:opacity-40 dark:bg-amber-700 dark:hover:bg-amber-600"
            >
              가져오기 시작
            </button>
          ) : (
            <button
              type="button"
              onClick={cancelImport}
              className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700"
            >
              중단
            </button>
          )}
        </div>
      </form>

      {/* 진행 상태 */}
      {(isImporting || importedGames.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {isImporting && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-300 border-t-amber-700" />
            )}
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {isImporting
                ? `가져오는 중... (${importedGames.length}개 완료)`
                : `총 ${importedGames.length}개 게임을 가져왔습니다.`
              }
            </p>
          </div>

          <div className="space-y-2">
            {importedGames.map((game) => (
              <GameListItem key={game.id} game={game} />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
