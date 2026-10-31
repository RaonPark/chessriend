import { AnalysisSummary } from './AnalysisSummary'
import { formatTimeControl } from '../utils/timeCategory'
import type { GameAnalysis, GameDetailResponse, GameSource } from '../types/game'

interface GameInfoPanelProps {
  game: GameDetailResponse
  analysis: GameAnalysis | null
  onDelete: () => void
  isDeleting: boolean
}

const SOURCE_LABELS: Record<GameSource, string> = {
  CHESS_COM: 'Chess.com',
  LICHESS: 'lichess',
  PGN: 'PGN',
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

/** "경기 정보" 탭: 메타 정보 + 분석 결과 표 + 게임 삭제 */
export function GameInfoPanel({ game, analysis, onDelete, isDeleting }: GameInfoPanelProps) {
  const rows: [string, string][] = [
    ['플랫폼', SOURCE_LABELS[game.source]],
    ['시간 제한', formatTimeControl(game.timeControl)],
    ['오프닝', game.opening ? `${game.opening.name}${game.opening.eco ? ` (${game.opening.eco})` : ''}` : '-'],
    ['총 수', `${game.totalMoves}수`],
    ['대국 날짜', formatDate(game.playedAt)],
  ]

  return (
    <div className="space-y-3">
      <dl className="divide-y divide-amber-100 rounded-xl border border-amber-200 bg-white px-4 text-sm dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 py-2.5">
            <dt className="shrink-0 text-amber-600 dark:text-amber-500">{label}</dt>
            <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{value}</dd>
          </div>
        ))}
      </dl>

      {analysis && (
        <AnalysisSummary
          analysis={analysis}
          moves={game.moves}
          whiteName={game.white.name}
          blackName={game.black.name}
        />
      )}

      <div className="flex justify-end">
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
        >
          {isDeleting ? '삭제 중...' : '게임 삭제'}
        </button>
      </div>
    </div>
  )
}
