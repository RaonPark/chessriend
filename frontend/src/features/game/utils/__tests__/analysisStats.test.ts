import { describe, it, expect } from 'vitest'
import { summarizeAnalysis } from '../analysisStats'
import type { GameAnalysis, MoveClassification, MoveResponse } from '../../types/game'

const MOVES: MoveResponse[] = [
  { number: 1, color: 'WHITE', san: 'e4' },
  { number: 1, color: 'BLACK', san: 'e5' },
  { number: 2, color: 'WHITE', san: 'Nf3' },
  { number: 2, color: 'BLACK', san: 'f6' },
]

// 백 수는 평가 하락, 흑 수는 평가 상승이 손실
const ev = (moveIndex: number, loss: number, classification: MoveClassification | null = null) => ({
  moveIndex,
  evalBefore: { cp: 0, mate: null },
  evalAfter: { cp: moveIndex % 2 === 0 ? -loss : loss, mate: null },
  cpLoss: loss,
  classification,
})

const analysis = (evaluations: GameAnalysis['evaluations']): GameAnalysis => ({ evaluations, depth: 18, analyzedAt: '' })

describe('summarizeAnalysis', () => {
  it('색별로 분류 개수를 센다', () => {
    const s = summarizeAnalysis(analysis([ev(0, 10, 'mistake'), ev(1, 0), ev(2, 300, 'blunder'), ev(3, 120, 'mistake')]), MOVES)
    expect(s.white.counts).toEqual({ brilliant: 0, blunder: 1, mistake: 1, inaccuracy: 0 })
    expect(s.black.counts).toEqual({ brilliant: 0, blunder: 0, mistake: 1, inaccuracy: 0 })
  })

  it('색별 평균 cp loss(반올림)를 계산한다', () => {
    const s = summarizeAnalysis(analysis([ev(0, 10), ev(1, 0), ev(2, 21), ev(3, 120)]), MOVES)
    expect(s.white.acpl).toBe(16)
    expect(s.black.acpl).toBe(60)
  })

  it('해당 색의 평가가 없으면 acpl은 null', () => {
    const s = summarizeAnalysis(analysis([ev(0, 30)]), MOVES)
    expect(s.white.acpl).toBe(30)
    expect(s.black.acpl).toBeNull()
  })
})
