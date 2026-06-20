import { useState } from 'react'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { useCreateGameFromPgn } from '../api/mutations'
import { GameListItem } from './GameListItem'
import type { GameResponse } from '../types/game'

const PLACEHOLDER = `[Event "Casual Game"]
[White "나"]
[Black "상대"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`

export function PgnImportForm() {
  const [pgn, setPgn] = useState('')
  const [createdGames, setCreatedGames] = useState<GameResponse[]>([])
  const mutation = useCreateGameFromPgn()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = pgn.trim()
    if (!trimmed || mutation.isPending) return

    mutation.mutate(
      { pgn: trimmed },
      {
        onSuccess: (game) => {
          setCreatedGames((prev) => [game, ...prev])
          setPgn('')
        },
      },
    )
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-amber-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div>
          <label htmlFor="pgn-input" className="block text-sm font-medium text-amber-800 dark:text-amber-300">
            PGN 기보
          </label>
          <textarea
            id="pgn-input"
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
            disabled={mutation.isPending}
            rows={12}
            placeholder={PLACEHOLDER}
            className="mt-1 w-full resize-y rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 font-mono text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder:text-gray-500"
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            chess.com / lichess의 게임 PGN을 그대로 붙여넣으세요. 수순·코멘트·변형선을 함께 가져옵니다.
            (표준 시작 포지션 게임 1개)
          </p>
        </div>

        <button
          type="submit"
          disabled={!pgn.trim() || mutation.isPending}
          className="rounded-lg bg-amber-800 px-6 py-2.5 text-sm font-medium text-amber-50 hover:bg-amber-900 disabled:opacity-40 dark:bg-amber-700 dark:hover:bg-amber-600"
        >
          {mutation.isPending ? '가져오는 중...' : '게임 가져오기'}
        </button>
      </form>

      {mutation.isError && (
        <ErrorMessage message={(mutation.error as Error).message || 'PGN을 가져오지 못했습니다.'} />
      )}

      {createdGames.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {createdGames.length}개 게임을 가져왔습니다.
          </p>
          <div className="space-y-2">
            {createdGames.map((game) => (
              <GameListItem key={game.id} game={game} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
