import { Fragment } from 'react'
import type { GameAnalysis, MoveClassification, MoveResponse } from '../types/game'

interface AnalysisSummaryProps {
  analysis: GameAnalysis
  moves: MoveResponse[]
  whiteName: string
  blackName: string
  onReanalyze: () => void
}

type Counts = Record<MoveClassification, number>

const emptyCounts = (): Counts => ({ brilliant: 0, blunder: 0, mistake: 0, inaccuracy: 0 })

const CLASSIFICATIONS: readonly MoveClassification[] = ['brilliant', 'blunder', 'mistake', 'inaccuracy']

const BADGE_CONFIG = {
  brilliant: { label: 'Brilliant', dotClass: 'bg-cyan-500', textClass: 'text-cyan-700 dark:text-cyan-400' },
  blunder: { label: 'Blunder', dotClass: 'bg-red-500', textClass: 'text-red-700 dark:text-red-400' },
  mistake: { label: 'Mistake', dotClass: 'bg-orange-500', textClass: 'text-orange-700 dark:text-orange-400' },
  inaccuracy: { label: 'Inaccuracy', dotClass: 'bg-yellow-500', textClass: 'text-yellow-700 dark:text-yellow-400' },
} as const satisfies Record<MoveClassification, { label: string; dotClass: string; textClass: string }>

export function AnalysisSummary({ analysis, moves, whiteName, blackName, onReanalyze }: AnalysisSummaryProps) {
  const whiteCounts = emptyCounts()
  const blackCounts = emptyCounts()

  for (const ev of analysis.evaluations) {
    if (!ev.classification) continue
    const move = moves[ev.moveIndex]
    if (move?.color === 'WHITE') {
      whiteCounts[ev.classification]++
    } else {
      blackCounts[ev.classification]++
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between">
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

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-xs">
        <span />
        <div
          className="flex min-w-0 items-center justify-center gap-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300"
          title={whiteName}
        >
          <span className="text-base leading-none">&#9812;</span>
          <span className="truncate">{whiteName}</span>
        </div>
        <div
          className="flex min-w-0 items-center justify-center gap-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300"
          title={blackName}
        >
          <span className="text-base leading-none">&#9818;</span>
          <span className="truncate">{blackName}</span>
        </div>

        {CLASSIFICATIONS.map((type) => {
          const config = BADGE_CONFIG[type]
          return (
            <Fragment key={type}>
              <div className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${config.dotClass}`} />
                <span className={`font-medium ${config.textClass}`}>{config.label}</span>
              </div>
              <span className="text-center font-mono font-medium tabular-nums text-gray-800 dark:text-gray-100">
                {whiteCounts[type]}
              </span>
              <span className="text-center font-mono font-medium tabular-nums text-gray-800 dark:text-gray-100">
                {blackCounts[type]}
              </span>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
