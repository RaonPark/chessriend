import type { GameAnalysis, MoveClassification, MoveResponse } from '../types/game'
import { moveCpLoss } from './cpLoss'

export interface SideStats {
  counts: Record<MoveClassification, number>
  /** 평균 centipawn loss (반올림). 해당 색의 평가가 없으면 null */
  acpl: number | null
}

const emptyCounts = (): Record<MoveClassification, number> => ({ brilliant: 0, blunder: 0, mistake: 0, inaccuracy: 0 })

/** 분석 결과를 백/흑별 분류 개수 + 평균 cp loss로 요약 */
export function summarizeAnalysis(analysis: GameAnalysis, moves: MoveResponse[]): { white: SideStats; black: SideStats } {
  const sides = {
    white: { counts: emptyCounts(), sum: 0, n: 0 },
    black: { counts: emptyCounts(), sum: 0, n: 0 },
  }
  for (const ev of analysis.evaluations) {
    const isWhite = moves[ev.moveIndex]?.color === 'WHITE'
    const side = isWhite ? sides.white : sides.black
    side.sum += moveCpLoss(ev.evalBefore, ev.evalAfter, isWhite)
    side.n++
    if (ev.classification) side.counts[ev.classification]++
  }
  const toStats = ({ counts, sum, n }: typeof sides.white): SideStats => ({
    counts,
    acpl: n > 0 ? Math.round(sum / n) : null,
  })
  return { white: toStats(sides.white), black: toStats(sides.black) }
}
