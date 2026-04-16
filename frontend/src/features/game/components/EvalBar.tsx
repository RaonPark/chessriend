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
  const isFlipped = orientation === 'black'

  // 보드 방향에 따라 바 방향 조정
  // orientation='white': 상단=흑, 하단=백 → topPercent = 흑 비율
  // orientation='black': 상단=백, 하단=흑 → topPercent = 백 비율
  const topPercent = isFlipped ? whitePercent : (100 - whitePercent)

  // 상단/하단 색상도 orientation에 따라 뒤집기
  const topColor = isFlipped
    ? 'bg-white transition-all duration-300 ease-out dark:bg-gray-200'
    : 'bg-gray-800 transition-all duration-300 ease-out dark:bg-gray-600'
  const bottomColor = isFlipped
    ? 'bg-gray-800 dark:bg-gray-600'
    : 'bg-white dark:bg-gray-200'

  const isWhiteAdvantage = evaluation != null && (
    (evaluation.cp !== null && evaluation.cp > 0) ||
    (evaluation.mate !== null && evaluation.mate > 0)
  )

  // 유리한 쪽 영역에 숫자 표시
  // orientation='white': 백 유리 → 하단(백 영역), 흑 유리 → 상단(흑 영역)
  // orientation='black': 백 유리 → 상단(백 영역), 흑 유리 → 하단(흑 영역)
  const showOnBottom = isFlipped ? !isWhiteAdvantage : isWhiteAdvantage

  // 텍스트 색상: 배경이 밝으면 어두운 글씨, 배경이 어두우면 밝은 글씨
  const topIsDark = !isFlipped
  const textColor = showOnBottom
    ? (topIsDark ? 'text-gray-700' : 'text-gray-200')   // bottom: flipped면 어두운 배경, 아니면 밝은 배경
    : (topIsDark ? 'text-gray-200' : 'text-gray-700')   // top

  return (
    <div className="relative flex h-full w-7 flex-col overflow-hidden rounded-md border border-amber-200 dark:border-gray-600" title={evaluation ? `Depth ${evaluation.depth}` : ''}>
      {/* 상단 영역 */}
      <div
        className={topColor}
        style={{ height: `${topPercent}%` }}
      />
      {/* 하단 영역 */}
      <div
        className={`flex-1 ${bottomColor}`}
      />

      {/* 평가치 텍스트: 유리한 쪽 영역에 고정 */}
      <div className={`absolute inset-x-0 flex items-center justify-center ${
        showOnBottom ? 'bottom-1' : 'top-1'
      }`}>
        <span className={`text-[10px] font-bold ${textColor}`}>
          {isEvaluating && !evaluation ? '...' : formatEval(evaluation)}
        </span>
      </div>
    </div>
  )
}
