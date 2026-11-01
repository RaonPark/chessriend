import { Fragment, useId, useState } from 'react'
import type { GameAnalysis, MoveClassification, MoveResponse } from '../types/game'
import { summarizeAnalysis } from '../utils/analysisStats'

interface AnalysisSummaryProps {
  analysis: GameAnalysis
  moves: MoveResponse[]
  whiteName: string
  blackName: string
}

const CLASSIFICATIONS: readonly MoveClassification[] = ['brilliant', 'only', 'blunder', 'mistake', 'inaccuracy']

const BADGE_CONFIG = {
  brilliant: { label: 'Brilliant', dotClass: 'bg-cyan-500', textClass: 'text-cyan-700 dark:text-cyan-400' },
  only: { label: 'Only move', dotClass: 'bg-sky-500', textClass: 'text-sky-700 dark:text-sky-400' },
  blunder: { label: 'Blunder', dotClass: 'bg-red-500', textClass: 'text-red-700 dark:text-red-400' },
  mistake: { label: 'Mistake', dotClass: 'bg-orange-500', textClass: 'text-orange-700 dark:text-orange-400' },
  inaccuracy: { label: 'Inaccuracy', dotClass: 'bg-yellow-500', textClass: 'text-yellow-700 dark:text-yellow-400' },
} as const satisfies Record<MoveClassification, { label: string; dotClass: string; textClass: string }>

export function AnalysisSummary({ analysis, moves, whiteName, blackName }: AnalysisSummaryProps) {
  const { white, black } = summarizeAnalysis(analysis, moves)
  const formatAcpl = (acpl: number | null) => (acpl == null ? '-' : String(acpl))

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
              <span className="text-center font-medium tabular-nums text-gray-800 dark:text-gray-100">
                {white.counts[type]}
              </span>
              <span className="text-center font-medium tabular-nums text-gray-800 dark:text-gray-100">
                {black.counts[type]}
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
          className="text-center font-medium tabular-nums text-gray-800 dark:text-gray-100"
        >
          {formatAcpl(white.acpl)}
        </span>
        <span
          data-testid="acpl-black"
          className="text-center font-medium tabular-nums text-gray-800 dark:text-gray-100"
        >
          {formatAcpl(black.acpl)}
        </span>
      </div>
    </div>
  )
}

/** cp loss 설명 툴팁 (호버/키보드 포커스로 표시) */
// 툴팁 크기 추정값 (w-64 = 256px, 본문 4~5줄) — 펼칠 방향을 고를 때 사용
const TOOLTIP_WIDTH = 256
const TOOLTIP_HEIGHT = 200
const VIEWPORT_MARGIN = 8

type TooltipPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'

const PLACEMENT_CLASS: Record<TooltipPlacement, string> = {
  'bottom-start': 'left-0 top-full mt-1.5',
  'bottom-end': 'right-0 top-full mt-1.5',
  'top-start': 'left-0 bottom-full mb-1.5',
  'top-end': 'right-0 bottom-full mb-1.5',
}

/** 버튼 위치를 보고 화면 밖으로 나가지 않는 방향 선택 (아래 공간 부족 → 위, 오른쪽 부족 → 왼쪽으로) */
function choosePlacement(button: HTMLElement): TooltipPlacement {
  const rect = button.getBoundingClientRect()
  const fitsBelow = rect.bottom + TOOLTIP_HEIGHT + VIEWPORT_MARGIN <= window.innerHeight
  const fitsRight = rect.left + TOOLTIP_WIDTH + VIEWPORT_MARGIN <= window.innerWidth
  return `${fitsBelow ? 'bottom' : 'top'}-${fitsRight ? 'start' : 'end'}`
}

export function CpLossHelp() {
  const [placement, setPlacement] = useState<TooltipPlacement | null>(null)
  const open = placement !== null
  const tooltipId = useId()
  const show = (e: React.SyntheticEvent<HTMLButtonElement>) => setPlacement(choosePlacement(e.currentTarget))
  const hide = () => setPlacement(null)

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="cp loss 설명"
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-300 text-[10px] font-bold leading-none text-amber-600 transition hover:bg-amber-50 dark:border-gray-500 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        ?
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          data-placement={placement}
          className={`absolute ${PLACEMENT_CLASS[placement]} z-20 w-64 rounded-lg border border-amber-200 bg-white p-3 text-left text-[11px] font-normal leading-relaxed text-gray-700 shadow-lg dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200`}
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
