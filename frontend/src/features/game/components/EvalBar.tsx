import type { EvalResult } from '../hooks/useStockfish'

interface EvalBarProps {
  evaluation: EvalResult | null
  isEvaluating: boolean
  orientation?: 'white' | 'black'
}

function evalToWhitePercent(evaluation: EvalResult | null): number {
  if (!evaluation) return 50

  if (evaluation.mate !== null) {
    // mate: 양수=백 메이트 유리, 음수=흑 메이트 유리
    return evaluation.mate > 0 ? 100 : 0
  }

  if (evaluation.cp !== null) {
    // cp를 0~100%로 변환 (sigmoid-like)
    // lichess 스타일: ±400cp에서 거의 끝단
    const cp = Math.max(-1000, Math.min(1000, evaluation.cp))
    return 50 + 50 * (2 / (1 + Math.exp(-0.004 * cp)) - 1)
  }

  return 50
}

function formatEval(evaluation: EvalResult | null): string {
  if (!evaluation) return ''

  if (evaluation.mate !== null) {
    return `M${Math.abs(evaluation.mate)}`
  }

  if (evaluation.cp !== null) {
    const value = Math.abs(evaluation.cp) / 100
    return value.toFixed(1)
  }

  return ''
}

export function EvalBar({ evaluation, isEvaluating, orientation = 'white' }: EvalBarProps) {
  const whitePercent = evalToWhitePercent(evaluation)
  // 보드 방향에 따라 바 방향 조정
  const topPercent = orientation === 'white' ? (100 - whitePercent) : whitePercent

  const isWhiteAdvantage = evaluation != null && (
    (evaluation.cp !== null && evaluation.cp > 0) ||
    (evaluation.mate !== null && evaluation.mate > 0)
  )

  // 백 유리 → 숫자가 백 영역(바 하단)에, 흑 유리 → 숫자가 흑 영역(바 상단)에
  // orientation이 black이면 바가 뒤집혀 있으므로 위치도 반전
  const showOnBottom = orientation === 'white' ? isWhiteAdvantage : !isWhiteAdvantage

  return (
    <div className="relative flex h-full w-7 flex-col overflow-hidden rounded-md border border-amber-200 dark:border-gray-600" title={evaluation ? `Depth ${evaluation.depth}` : ''}>
      {/* 흑 영역 (상단) */}
      <div
        className="bg-gray-800 transition-all duration-300 ease-out dark:bg-gray-600"
        style={{ height: `${topPercent}%` }}
      />
      {/* 백 영역 (하단) */}
      <div
        className="flex-1 bg-white transition-all duration-300 ease-out dark:bg-gray-200"
      />

      {/* 평가치 텍스트: 유리한 쪽 영역에 고정 */}
      <div className={`absolute inset-x-0 flex items-center justify-center ${
        showOnBottom ? 'bottom-1' : 'top-1'
      }`}>
        <span className={`text-[10px] font-bold ${
          showOnBottom
            ? 'text-gray-700'
            : 'text-gray-200'
        }`}>
          {isEvaluating && !evaluation ? '...' : formatEval(evaluation)}
        </span>
      </div>
    </div>
  )
}
