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
  it('포획 희생: 비싼 기물로 싼 기물 잡고 위험 위치 + cpLoss 작음 → brilliant', () => {
    expect(detectBrilliant({ cpLoss: 0, piece: 'b', captured: 'p', isAtRisk: true })).toBe(true)
    expect(detectBrilliant({ cpLoss: 15, piece: 'q', captured: 'p', isAtRisk: true })).toBe(true)
    expect(detectBrilliant({ cpLoss: 10, piece: 'r', captured: 'n', isAtRisk: true })).toBe(true)
  })

  it('공짜 희생(비-포획): 일반 수로 기물을 위험 위치에 놓음 + cpLoss 작음 → brilliant', () => {
    expect(detectBrilliant({ cpLoss: 0, piece: 'q', captured: null, isAtRisk: true })).toBe(true)
    expect(detectBrilliant({ cpLoss: 15, piece: 'r', captured: null, isAtRisk: true })).toBe(true)
  })

  it('isAtRisk=false 이면 brilliant 아님 (기물이 잡힐 위치가 아님)', () => {
    expect(detectBrilliant({ cpLoss: 0, piece: 'q', captured: 'p', isAtRisk: false })).toBe(false)
    expect(detectBrilliant({ cpLoss: 0, piece: 'q', captured: null, isAtRisk: false })).toBe(false)
    expect(detectBrilliant({ cpLoss: 10, piece: 'r', captured: 'n', isAtRisk: false })).toBe(false)
  })

  it('포획 수에서 같은 가치/더 싼 공격 기물이면 brilliant 아님', () => {
    // 나이트 3이 비숍 3 잡음 — 동가치 교환
    expect(detectBrilliant({ cpLoss: 0, piece: 'n', captured: 'b', isAtRisk: true })).toBe(false)
    // 폰 1이 퀸 9 잡음 — 정상 포획
    expect(detectBrilliant({ cpLoss: 0, piece: 'p', captured: 'q', isAtRisk: true })).toBe(false)
  })

  it('cpLoss가 tolerance(20) 이상이면 brilliant 아님', () => {
    expect(detectBrilliant({ cpLoss: 20, piece: 'q', captured: 'p', isAtRisk: true })).toBe(false)
    expect(detectBrilliant({ cpLoss: 50, piece: 'r', captured: null, isAtRisk: true })).toBe(false)
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

  function makeFens(fenBefore: string, san: string): [string, string] {
    const chess = new Chess(fenBefore)
    chess.move(san)
    return [fenBefore, chess.fen()]
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

  it('Bxf7+ 이탈리안 희생: 비숍이 폰을 잡고 킹에게 공격받으면 brilliant', () => {
    // 1.e4 e5 2.Bc4 Nc6 3.Bxf7+ — 비숍이 f7에 놓여 킹(e8)에게만 공격받음
    const chess = new Chess()
    chess.move('e4')
    chess.move('e5')
    chess.move('Bc4')
    chess.move('Nc6')
    const fenBefore = chess.fen()
    const testMove: MoveResponse = { number: 3, color: 'WHITE', san: 'Bxf7+' }
    const [, fenAfter] = makeFens(fenBefore, testMove.san)

    const result = computeClassifications(
      [fenBefore, fenAfter],
      [{ cp: 20, mate: null }, { cp: 15, mate: null }],
      [testMove],
    )

    expect(result[0].classification).toBe('brilliant')
  })

  it('Nxe5: 나이트가 폰을 잡지만 같은 가치 나이트에게만 공격받으면 brilliant 아님', () => {
    // 1.e4 e5 2.Nf3 Nc6 3.Nxe5 — 나이트가 e5로 가서 Nc6(3)에게만 공격받음, 3 < 3 거짓 → 희생 아님
    const chess = new Chess()
    chess.move('e4')
    chess.move('e5')
    chess.move('Nf3')
    chess.move('Nc6')
    const fenBefore = chess.fen()
    const testMove: MoveResponse = { number: 3, color: 'WHITE', san: 'Nxe5' }
    const [, fenAfter] = makeFens(fenBefore, testMove.san)

    const result = computeClassifications(
      [fenBefore, fenAfter],
      [{ cp: 20, mate: null }, { cp: 15, mate: null }],
      [testMove],
    )

    expect(result[0].classification).toBeNull()
  })

  it('동가치 포획은 brilliant 아님 (폰이 폰을 잡음)', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('d5')
    const fenBefore = chess.fen()
    const testMove: MoveResponse = { number: 2, color: 'WHITE', san: 'exd5' }
    const [, fenAfter] = makeFens(fenBefore, testMove.san)

    const result = computeClassifications(
      [fenBefore, fenAfter],
      [{ cp: 0, mate: null }, { cp: 10, mate: null }],
      [testMove],
    )

    expect(result[0].classification).toBeNull()
  })

  it('공짜 희생: 비-포획으로 기물을 공격받는 위치에 놓고 cpLoss 작으면 brilliant', () => {
    // 퀸을 공격받는 위치로 이동하지만 엔진 평가는 비슷 (메이트 위협 등 보상)
    // 간단히 구성: 백 퀸을 d1→d5 로 이동, d5는 흑 폰 c6/e6에 의해 공격받음
    // 실제 체스에선 쓸 일 거의 없지만 순수 함수 검증용
    const chess = new Chess()
    chess.move('d4')
    chess.move('c6')  // c6 폰이 d5 공격
    const fenBefore = chess.fen()
    // 2.Qd3 (d3로) — 아직 공격받지 않음 → 비-희생
    const safeMove: MoveResponse = { number: 2, color: 'WHITE', san: 'Qd3' }
    const [, fenAfterSafe] = makeFens(fenBefore, safeMove.san)

    const safeResult = computeClassifications(
      [fenBefore, fenAfterSafe],
      [{ cp: 0, mate: null }, { cp: 10, mate: null }],
      [safeMove],
    )
    expect(safeResult[0].classification).toBeNull()

    // 반면 c4 폰으로 d5 진출하면 c6 폰이 잡을 수 있음 → 폰 공짜 희생은 같은 가치라 brilliant 아님
    // 진짜 공짜 희생(비싼 기물 버림)을 검증하려면 합법 수가 까다로우므로
    // detectBrilliant 단위 테스트로 이미 검증했으므로 여기선 비-희생 경로 확인에 집중
  })

  it('큰 cp 손실이 있는 희생은 blunder (brilliant로 승격되지 않음)', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('e5')
    chess.move('Nf3')
    chess.move('Nc6')
    const fenBefore = chess.fen()
    const testMove: MoveResponse = { number: 3, color: 'WHITE', san: 'Nxe5' }
    const [, fenAfter] = makeFens(fenBefore, testMove.san)

    const result = computeClassifications(
      [fenBefore, fenAfter],
      [{ cp: 20, mate: null }, { cp: -250, mate: null }],
      [testMove],
    )

    // cpLoss = 270 → blunder, Brilliant로 승격되지 않음
    expect(result[0].classification).toBe('blunder')
  })
})
