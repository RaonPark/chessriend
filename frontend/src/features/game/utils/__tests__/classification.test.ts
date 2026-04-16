import { describe, it, expect } from 'vitest'
import { evalToCp, classifyMove, computeClassifications } from '../classification'
import type { EvalScore, MoveResponse } from '../../types/game'

describe('evalToCp', () => {
  it('cp 값을 그대로 반환한다', () => {
    expect(evalToCp({ cp: 150, mate: null })).toBe(150)
    expect(evalToCp({ cp: -200, mate: null })).toBe(-200)
    expect(evalToCp({ cp: 0, mate: null })).toBe(0)
  })

  it('양수 mate-in-N을 높은 양수 cp로 변환한다', () => {
    expect(evalToCp({ cp: null, mate: 1 })).toBe(9999)   // mate-in-1
    expect(evalToCp({ cp: null, mate: 5 })).toBe(9995)   // mate-in-5
  })

  it('음수 mate-in-N을 높은 음수 cp로 변환한다', () => {
    expect(evalToCp({ cp: null, mate: -1 })).toBe(-9999)
    expect(evalToCp({ cp: null, mate: -3 })).toBe(-9997)
  })

  it('cp와 mate 모두 null이면 0을 반환한다', () => {
    expect(evalToCp({ cp: null, mate: null })).toBe(0)
  })
})

describe('classifyMove', () => {
  it('200cp 이상 손실은 blunder', () => {
    expect(classifyMove(200)).toBe('blunder')
    expect(classifyMove(500)).toBe('blunder')
  })

  it('100-200cp 손실은 mistake', () => {
    expect(classifyMove(100)).toBe('mistake')
    expect(classifyMove(199)).toBe('mistake')
  })

  it('50-100cp 손실은 inaccuracy', () => {
    expect(classifyMove(50)).toBe('inaccuracy')
    expect(classifyMove(99)).toBe('inaccuracy')
  })

  it('50cp 미만은 null (정상 수)', () => {
    expect(classifyMove(0)).toBeNull()
    expect(classifyMove(49)).toBeNull()
  })
})

describe('computeClassifications', () => {
  const moves: MoveResponse[] = [
    { number: 1, color: 'WHITE', san: 'e4' },
    { number: 1, color: 'BLACK', san: 'e5' },
    { number: 2, color: 'WHITE', san: 'Qh5' },
  ]

  it('각 수의 cpLoss와 classification을 계산한다', () => {
    const positionEvals: EvalScore[] = [
      { cp: 20, mate: null },   // 시작 (백 약간 유리)
      { cp: 15, mate: null },   // 1.e4 후 (cpLoss = 20-15 = 5, 백 수)
      { cp: 50, mate: null },   // 1...e5 후 (cpLoss = 50-15 = 35, 흑 수 - 흑 관점으로 손실)
      { cp: -100, mate: null }, // 2.Qh5 후 (cpLoss = 50-(-100) = 150, 백 수)
    ]

    const result = computeClassifications(positionEvals, moves)

    expect(result).toHaveLength(3)

    // 1.e4: cpLoss = 5, null
    expect(result[0].moveIndex).toBe(0)
    expect(result[0].cpLoss).toBe(5)
    expect(result[0].classification).toBeNull()

    // 1...e5: 흑의 수, cpLoss = 50 - 15 = 35, null
    expect(result[1].moveIndex).toBe(1)
    expect(result[1].cpLoss).toBe(35)
    expect(result[1].classification).toBeNull()

    // 2.Qh5: cpLoss = 50 - (-100) = 150, mistake
    expect(result[2].moveIndex).toBe(2)
    expect(result[2].cpLoss).toBe(150)
    expect(result[2].classification).toBe('mistake')
  })

  it('메이트 점수 전환을 처리한다', () => {
    const positionEvals: EvalScore[] = [
      { cp: 500, mate: null },   // 백 매우 유리
      { cp: null, mate: -2 },    // 1.?? 후 흑이 메이트 가능 (대실수)
    ]

    const movesOne: MoveResponse[] = [
      { number: 1, color: 'WHITE', san: 'f3' },
    ]

    const result = computeClassifications(positionEvals, movesOne)

    expect(result[0].cpLoss).toBeGreaterThanOrEqual(200)
    expect(result[0].classification).toBe('blunder')
  })

  it('cpLoss가 음수가 되지 않는다 (좋은 수)', () => {
    const positionEvals: EvalScore[] = [
      { cp: -50, mate: null },
      { cp: 100, mate: null },  // 백의 수로 크게 개선
    ]

    const movesOne: MoveResponse[] = [
      { number: 1, color: 'WHITE', san: 'Nf3' },
    ]

    const result = computeClassifications(positionEvals, movesOne)

    expect(result[0].cpLoss).toBe(0) // clamped to 0
    expect(result[0].classification).toBeNull()
  })

  it('빈 수 목록은 빈 결과를 반환한다', () => {
    const result = computeClassifications([{ cp: 0, mate: null }], [])
    expect(result).toHaveLength(0)
  })
})
