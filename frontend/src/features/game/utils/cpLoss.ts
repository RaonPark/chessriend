import type { EvalScore } from '../types/game'

// lichess ACPL 방식: 평가를 ±1000cp로 제한 (메이트는 ±1000) — 메이트 하나로 평균이 폭주하지 않게
const CP_CEILING = 1000

function clampedCp(score: EvalScore): number {
  if (score.mate != null) return score.mate > 0 ? CP_CEILING : -CP_CEILING
  return Math.max(-CP_CEILING, Math.min(CP_CEILING, score.cp ?? 0))
}

/** 한 수의 centipawn loss (백 관점 평가 → 둔 쪽 기준 손실, 0 이상) */
export function moveCpLoss(evalBefore: EvalScore, evalAfter: EvalScore, isWhite: boolean): number {
  const before = clampedCp(evalBefore)
  // 수 직후 mate 0 = 방금 둔 쪽이 메이트시킴 (UCI mate 0에는 부호가 없어 승자 정보가 사라짐)
  const after = evalAfter.mate === 0 ? (isWhite ? CP_CEILING : -CP_CEILING) : clampedCp(evalAfter)
  return Math.max(0, isWhite ? before - after : after - before)
}
