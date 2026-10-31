import { Fragment, useId, useState } from 'react'
import type { GameAnalysis, MoveClassification, MoveResponse } from '../types/game'
import { moveCpLoss } from '../utils/cpLoss'

interface AnalysisSummaryProps {
  analysis: GameAnalysis
  moves: MoveResponse[]
  whiteName: string
  blackName: string
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

export function AnalysisSummary({ analysis, moves, whiteName, blackName }: AnalysisSummaryProps) {
  const whiteCounts = emptyCounts()
  const blackCounts = emptyCounts()
  // 평균 cp loss (ACPL) 계산용
  const cpLoss = { white: { sum: 0, count: 0 }, black: { sum: 0, count: 0 } }

  for (const ev of analysis.evaluations) {
    const isWhite = moves[ev.moveIndex]?.color === 'WHITE'
    const side = isWhite ? cpLoss.white : cpLoss.black
    side.sum += moveCpLoss(ev.evalBefore, ev.evalAfter, isWhite)
    side.count++

    if (!ev.classification) continue
    if (isWhite) {
      whiteCounts[ev.classification]++
    } else {
      blackCounts[ev.classification]++
    }
  }

  const averageOf = ({ sum, count }: { sum: number; count: number }) =>
    count > 0 ? String(Math.round(sum / count)) : '-'

  return (
    <div className="rounded-lg border border-amber-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3">
        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
          분석 결과 (depth {analysis.depth})
        </span>
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

        {/* 평균 centipawn loss */}
        <div className="col-span-3 mt-1 border-t border-amber-100 dark:border-gray-700" />
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-gray-700 dark:text-gray-300">cp loss</span>
          <CpLossHelp />
        </div>
        <span
          data-testid="acpl-white"
          className="text-center font-mono font-medium tabular-nums text-gray-800 dark:text-gray-100"
        >
          {averageOf(cpLoss.white)}
        </span>
        <span
          data-testid="acpl-black"
          className="text-center font-mono font-medium tabular-nums text-gray-800 dark:text-gray-100"
        >
          {averageOf(cpLoss.black)}
        </span>
      </div>
    </div>
  )
}

/** cp loss 설명 툴팁 (호버/키보드 포커스로 표시) */
function CpLossHelp() {
  const [open, setOpen] = useState(false)
  const tooltipId = useId()

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="cp loss 설명"
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-300 text-[10px] font-bold leading-none text-amber-600 transition hover:bg-amber-50 dark:border-gray-500 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        ?
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-1.5 w-64 rounded-lg border border-amber-200 bg-white p-3 text-left text-[11px] font-normal leading-relaxed text-gray-700 shadow-lg dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
        >
          <span className="mb-1 block font-semibold text-amber-700 dark:text-amber-400">Centipawn Loss (CPL)</span>
          매 수마다 엔진이 찾은 최선수와 비교해 <b>평가 점수를 얼마나 잃었는지</b>를 나타냅니다.
          1 centipawn = 폰 1/100개, 100이면 폰 하나만큼 손해를 본 셈입니다.
          <span className="mt-1 block">
            여기에 보이는 값은 플레이어별 <b>평균</b>(ACPL)이며, <b>낮을수록</b> 정확하게 둔 것입니다.
          </span>
          <span className="mt-1 block text-gray-500 dark:text-gray-400">
            메이트·큰 평가 차이는 ±1000으로 제한해 계산합니다 (lichess 방식).
          </span>
        </span>
      )}
    </span>
  )
}
