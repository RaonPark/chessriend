import type { GameAnalysis, MoveResponse } from '../types/game'

interface AnalysisSummaryProps {
  analysis: GameAnalysis
  moves: MoveResponse[]
  onReanalyze: () => void
}

export function AnalysisSummary({ analysis, moves, onReanalyze }: AnalysisSummaryProps) {
  const counts = { blunder: 0, mistake: 0, inaccuracy: 0 }
  const whiteCounts = { blunder: 0, mistake: 0, inaccuracy: 0 }
  const blackCounts = { blunder: 0, mistake: 0, inaccuracy: 0 }

  for (const ev of analysis.evaluations) {
    if (!ev.classification) continue
    counts[ev.classification]++
    const move = moves[ev.moveIndex]
    if (move?.color === 'WHITE') {
      whiteCounts[ev.classification]++
    } else {
      blackCounts[ev.classification]++
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
          분석 결과 (depth {analysis.depth})
        </span>
        <button
          onClick={onReanalyze}
          className="rounded px-2 py-0.5 text-xs font-medium text-amber-600 transition hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-gray-700"
        >
          재분석
        </button>
      </div>

      {/* 전체 요약 */}
      <div className="mb-2 flex gap-3">
        <ClassificationBadge type="blunder" count={counts.blunder} />
        <ClassificationBadge type="mistake" count={counts.mistake} />
        <ClassificationBadge type="inaccuracy" count={counts.inaccuracy} />
      </div>

      {/* 백/흑 분리 */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded bg-gray-50 px-2 py-1 dark:bg-gray-750">
          <span className="font-medium text-gray-600 dark:text-gray-400">백</span>
          <div className="mt-0.5 flex gap-2">
            <span className="text-red-500">{whiteCounts.blunder}B</span>
            <span className="text-orange-500">{whiteCounts.mistake}M</span>
            <span className="text-yellow-600">{whiteCounts.inaccuracy}I</span>
          </div>
        </div>
        <div className="rounded bg-gray-50 px-2 py-1 dark:bg-gray-750">
          <span className="font-medium text-gray-600 dark:text-gray-400">흑</span>
          <div className="mt-0.5 flex gap-2">
            <span className="text-red-500">{blackCounts.blunder}B</span>
            <span className="text-orange-500">{blackCounts.mistake}M</span>
            <span className="text-yellow-600">{blackCounts.inaccuracy}I</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ClassificationBadge({ type, count }: { type: 'blunder' | 'mistake' | 'inaccuracy'; count: number }) {
  const config = {
    blunder: { label: 'Blunder', dotClass: 'bg-red-500', textClass: 'text-red-700 dark:text-red-400' },
    mistake: { label: 'Mistake', dotClass: 'bg-orange-500', textClass: 'text-orange-700 dark:text-orange-400' },
    inaccuracy: { label: 'Inaccuracy', dotClass: 'bg-yellow-500', textClass: 'text-yellow-700 dark:text-yellow-400' },
  }[type]

  return (
    <div className="flex items-center gap-1">
      <span className={`inline-block h-2 w-2 rounded-full ${config.dotClass}`} />
      <span className={`text-xs font-medium ${config.textClass}`}>{count}</span>
      <span className="text-[10px] text-gray-500">{config.label}</span>
    </div>
  )
}
