import { describe, it, expect } from 'vitest'
import { Chess } from 'chess.js'
import { evalToCp, classifyMove, detectBrilliant, computeClassifications } from '../classification'
import type { EvalScore, MoveResponse } from '../../types/game'

describe('evalToCp', () => {
  it('cp 값을 그대로 반환한다', () => {
    expect(evalToCp({ cp: 150, mate: null })).toBe(150)
    expect(evalToCp({ cp: -200, mate: null })).toBe(-200)
    expect(evalToCp({ cp: 0, mate: null })).toBe(0)
  })

  it('양수 mate-in-N을 높은 양수 cp로 변환한다', () => {
    expect(evalToCp({ cp: null, mate: 1 })).toBe(9999)
    expect(evalToCp({ cp: null, mate: 5 })).toBe(9995)
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

  it('50cp 미만은 null (brilliant는 별도 판정)', () => {
    expect(classifyMove(0)).toBeNull()
    expect(classifyMove(49)).toBeNull()
  })
})

describe('detectBrilliant', () => {
  it('퀸이 폰을 잡고 cp 손실이 없으면 brilliant', () => {
    expect(detectBrilliant({ cpLoss: 0, attacker: 'q', captured: 'p' })).toBe(true)
  })

  it('룩이 나이트를 잡고 cpLoss가 tolerance 미만이면 brilliant (Exchange sac)', () => {
    expect(detectBrilliant({ cpLoss: 15, attacker: 'r', captured: 'n' })).toBe(true)
    expect(detectBrilliant({ cpLoss: 15, attacker: 'r', captured: 'b' })).toBe(true)
  })

  it('같은 값 기물 교환은 brilliant 아님', () => {
    expect(detectBrilliant({ cpLoss: 0, attacker: 'n', captured: 'b' })).toBe(false)
    expect(detectBrilliant({ cpLoss: 0, attacker: 'n', captured: 'n' })).toBe(false)
  })

  it('더 싼 기물로 더 비싼 기물을 잡으면 brilliant 아님 (정상 포획)', () => {
    expect(detectBrilliant({ cpLoss: 0, attacker: 'p', captured: 'q' })).toBe(false)
    expect(detectBrilliant({ cpLoss: 0, attacker: 'n', captured: 'r' })).toBe(false)
  })

  it('cpLoss가 tolerance(20) 이상이면 brilliant 아님', () => {
    expect(detectBrilliant({ cpLoss: 20, attacker: 'q', captured: 'p' })).toBe(false)
    expect(detectBrilliant({ cpLoss: 50, attacker: 'q', captured: 'p' })).toBe(false)
  })
})

describe('computeClassifications', () => {
  function fensFor(moves: MoveResponse[]): string[] {
    const chess = new Chess()
    const fens = [chess.fen()]
    for (const m of moves) {
      chess.move(m.san)
      fens.push(chess.fen())
    }
    return fens
  }

  const moves: MoveResponse[] = [
    { number: 1, color: 'WHITE', san: 'e4' },
    { number: 1, color: 'BLACK', san: 'e5' },
    { number: 2, color: 'WHITE', san: 'Qh5' },
  ]

  it('각 수의 cpLoss와 classification을 계산한다', () => {
    const fens = fensFor(moves)
    const positionEvals: EvalScore[] = [
      { cp: 20, mate: null },
      { cp: 15, mate: null },
      { cp: 50, mate: null },
      { cp: -100, mate: null },
    ]

    const result = computeClassifications(fens, positionEvals, moves)

    expect(result).toHaveLength(3)
    expect(result[0].cpLoss).toBe(5)
    expect(result[0].classification).toBeNull()
    expect(result[1].cpLoss).toBe(35)
    expect(result[1].classification).toBeNull()
    expect(result[2].cpLoss).toBe(150)
    expect(result[2].classification).toBe('mistake')
  })

  it('메이트 점수 전환을 처리한다', () => {
    const movesOne: MoveResponse[] = [{ number: 1, color: 'WHITE', san: 'f3' }]
    const fens = fensFor(movesOne)
    const positionEvals: EvalScore[] = [
      { cp: 500, mate: null },
      { cp: null, mate: -2 },
    ]

    const result = computeClassifications(fens, positionEvals, movesOne)

    expect(result[0].cpLoss).toBeGreaterThanOrEqual(200)
    expect(result[0].classification).toBe('blunder')
  })

  it('cpLoss가 음수가 되지 않는다 (좋은 수)', () => {
    const movesOne: MoveResponse[] = [{ number: 1, color: 'WHITE', san: 'Nf3' }]
    const fens = fensFor(movesOne)
    const positionEvals: EvalScore[] = [
      { cp: -50, mate: null },
      { cp: 100, mate: null },
    ]

    const result = computeClassifications(fens, positionEvals, movesOne)

    expect(result[0].cpLoss).toBe(0)
    expect(result[0].classification).toBeNull()
  })

  it('빈 수 목록은 빈 결과를 반환한다', () => {
    const result = computeClassifications([new Chess().fen()], [{ cp: 0, mate: null }], [])
    expect(result).toHaveLength(0)
  })

  it('퀸으로 폰을 희생적으로 잡고 평가가 유지되면 brilliant', () => {
    // 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4 5.c3 Ba5 6.d4 exd4 7.O-O
    // 이어서 흑이 퀸으로 폰을 잡는(희생)으로 해보기 위해 간단한 상황 설정
    // 여기서는 순수 검증을 위해 직접 FEN을 구성: 백이 Qxe5 (퀸으로 폰 포획), cpLoss ~0
    const chess = new Chess()
    chess.move('e4')
    chess.move('e5')
    chess.move('Qh5')
    chess.move('Nc6')
    // 백 Qxe5+ (퀸으로 e5 폰을 잡음 — 실제 게임에선 보통 나쁘지만, Brilliant 판정 로직 검증용)
    const fenBefore = chess.fen()
    const testMove: MoveResponse = { number: 3, color: 'WHITE', san: 'Qxe5+' }
    const chess2 = new Chess(fenBefore)
    chess2.move(testMove.san)
    const fenAfter = chess2.fen()

    const result = computeClassifications(
      [fenBefore, fenAfter],
      [{ cp: 0, mate: null }, { cp: 5, mate: null }],
      [testMove],
    )

    expect(result[0].cpLoss).toBe(0)
    expect(result[0].classification).toBe('brilliant')
  })

  it('포획이지만 같은 값의 기물 교환이면 brilliant 아님', () => {
    // 1.e4 e5 2.Nf3 Nc6 3.Nxe5 (나이트가 폰 잡음 — attacker > captured, brilliant 후보)
    // 위 케이스와 차별화 위해: 2.Nf3 d6 3.Nxe5 등 대신 직접 equal-trade 구성
    const chess = new Chess()
    chess.move('e4')
    chess.move('d5')
    // 백 exd5 (폰으로 폰) — equal
    const fenBefore = chess.fen()
    const testMove: MoveResponse = { number: 2, color: 'WHITE', san: 'exd5' }
    const chess2 = new Chess(fenBefore)
    chess2.move(testMove.san)
    const fenAfter = chess2.fen()

    const result = computeClassifications(
      [fenBefore, fenAfter],
      [{ cp: 0, mate: null }, { cp: 10, mate: null }],
      [testMove],
    )

    expect(result[0].classification).toBeNull()
  })

  it('큰 cp 손실이 있는 희생은 brilliant 아님 (그냥 blunder)', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('e5')
    chess.move('Nf3')
    chess.move('Nc6')
    // 백 Nxe5?? (나이트로 폰 — 그러나 Nxe5 후 Nxe5로 재포획당해 실제로는 cpLoss 큼)
    const fenBefore = chess.fen()
    const testMove: MoveResponse = { number: 3, color: 'WHITE', san: 'Nxe5' }
    const chess2 = new Chess(fenBefore)
    chess2.move(testMove.san)
    const fenAfter = chess2.fen()

    const result = computeClassifications(
      [fenBefore, fenAfter],
      [{ cp: 20, mate: null }, { cp: -250, mate: null }],
      [testMove],
    )

    // cpLoss = 270 → blunder, Brilliant로 승격되지 않음
    expect(result[0].classification).toBe('blunder')
  })
})
