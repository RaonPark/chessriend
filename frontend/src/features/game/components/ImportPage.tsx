import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGameImport } from '../hooks/useGameImport'
import { GameListItem } from './GameListItem'
import type { GameSource } from '../types/game'

export function ImportPage() {
  const [source, setSource] = useState<GameSource>('LICHESS')
  const [username, setUsername] = useState('')
  const [max, setMax] = useState(50)

  const { isImporting, importedGames, error, startImport, cancelImport } = useGameImport()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim()) return
    startImport({ source, username: username.trim(), max })
  }

  return (
    <div className="space-y-6">
      <Link to="/games" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
        &larr; 게임 목록
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">게임 가져오기</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 p-6 dark:border-gray-700">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">플랫폼</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as GameSource)}
            disabled={isImporting}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="LICHESS">Lichess</option>
            <option value="CHESS_COM">Chess.com</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">사용자명</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isImporting}
            placeholder={source === 'LICHESS' ? 'lichess 사용자명' : 'chess.com 사용자명'}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">최대 게임 수</label>
          <input
            type="number"
            value={max}
            onChange={(e) => setMax(Number(e.target.value))}
            disabled={isImporting}
            min={1}
            max={500}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>

        <div className="flex gap-3">
          {!isImporting ? (
            <button
              type="submit"
              disabled={!username.trim()}
              className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              가져오기 시작
            </button>
          ) : (
            <button
              type="button"
              onClick={cancelImport}
              className="rounded-lg bg-red-600 px-6 py-2 text-sm font-medium text-white hover:bg-red-700"
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
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
            )}
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
    </div>
  )
}
