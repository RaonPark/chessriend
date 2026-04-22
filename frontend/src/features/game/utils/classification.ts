import { Chess } from 'chess.js'
import type { EvalScore, MoveClassification, MoveEvaluation, MoveResponse } from '../types/game'

const MATE_SCORE = 10000

/**
 * 기물 점수 (체스 일반 통념): 폰 1, 나이트 3, 비숍 3, 룩 5, 퀸 9.
 * 킹은 잡힐 수 없으므로 제외.
 */
export const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
} as const satisfies Record<string, number>

export type PieceSymbol = keyof typeof PIECE_VALUES

/**
 * "거의 비슷" 기준 — cpLoss가 이 값 미만이면 희생이 유효하다고 간주.
 * depth 16 엔진 노이즈(±10~15cp)를 약간 상회하는 보수적 값.
 */
const BRILLIANT_CP_TOLERANCE = 20

/**
 * 킹이 공격자인 경우의 "교환 가치" — 킹은 잡혀도 잃지 않으므로 우리 기물은 순손실.
 * 가장 싼 공격자로 취급하기 위해 0 사용.
 */
const KING_AS_ATTACKER_VALUE = 0

/**
 * mate/cp 평가를 centipawn 단일 값으로 변환 (백 관점).
 * mate-in-N → ±(MATE_SCORE - |N|)
 */
export function evalToCp(eval_: EvalScore): number {
  if (eval_.mate !== null) {
    return eval_.mate > 0
      ? MATE_SCORE - Math.abs(eval_.mate)
      : -(MATE_SCORE - Math.abs(eval_.mate))
  }
  return eval_.cp ?? 0
}

/**
 * centipawn loss 기준으로 수를 분류.
 * Blunder: 200+cp, Mistake: 100-200cp, Inaccuracy: 50-100cp
 */
export function classifyMove(cpLoss: number): MoveClassification | null {
  if (cpLoss >= 200) return 'blunder'
  if (cpLoss >= 100) return 'mistake'
  if (cpLoss >= 50) return 'inaccuracy'
  return null
}

interface BrilliantContext {
  cpLoss: number
  /** 이동한 기물 */
  piece: PieceSymbol
  /** 포획한 기물 (없으면 null — 일반 수) */
  captured: PieceSymbol | null
  /**
   * 이동 후 기물이 잡힐 위치에 놓였는지 여부.
   * 즉 목적지 square를 공격하는 상대 기물 중 가장 싼 것의 가치가 이동 기물보다 낮은 경우.
   */
  isAtRisk: boolean
}

/**
 * Brilliant (!!): 기물을 희생에 놓았음에도 cp 손실이 거의 없는 수.
 *
 * 희생의 두 유형:
 * 1. **포획 희생**: 비싼 기물로 싼 기물을 잡았고 공격 기물이 잡힐 위치에 놓임
 *    (예: Bxf7+ 이탈리안 — 비숍 3으로 폰 1 잡고 킹 공격)
 * 2. **공짜 희생**: 일반 수로 기물을 공격받는 square에 놓음
 *    (예: Qg6 메이트 위협 — 퀸을 공짜로 놓았지만 안 잡으면 메이트)
 *
 * 두 경우 모두 cpLoss < 20 이어야 (엔진이 손실을 판단 못 할 만큼 보상이 있어야) brilliant.
 */
export function detectBrilliant({ cpLoss, piece, captured, isAtRisk }: BrilliantContext): boolean {
  if (cpLoss >= BRILLIANT_CP_TOLERANCE) return false
  if (!isAtRisk) return false
  // 포획 수의 경우: 공격 기물이 포획 기물보다 비싸야 진짜 희생 (더 싼 기물이 비싼 걸 잡는 건 정상 포획)
  if (captured !== null && PIECE_VALUES[piece] <= PIECE_VALUES[captured]) return false
  return true
}

interface MoveContext {
  piece: PieceSymbol
  captured: PieceSymbol | null
  isAtRisk: boolean
}

/**
 * FEN에서 SAN 수를 시뮬레이션하여 이동/포획 정보 및 희생 여부를 추출.
 *
 * 희생(isAtRisk) 판정: 이동 후 목적지 square를 공격하는 상대 기물 중 가장 싼 것이
 * 이동 기물보다 낮은 가치인 경우. 킹으로 재포획하는 경우는 우리 기물이
 * 순손실이므로 가장 낮은 가치(0)로 취급.
 */
function extractMoveContext(fenBefore: string, san: string): MoveContext | null {
  try {
    const chess = new Chess(fenBefore)
    const move = chess.move(san)

    const piece = move.piece as PieceSymbol
    const captured = (move.captured ?? null) as PieceSymbol | null

    // chess.move() 이후 turn이 상대로 넘어감 → chess.turn()은 상대 색
    const opponentColor = chess.turn()
    const pieceValue = PIECE_VALUES[piece]

    const enemyAttackerSquares = chess.attackers(move.to, opponentColor)
    const isAtRisk = enemyAttackerSquares.length > 0
      && cheapestAttackerValue(chess, enemyAttackerSquares) < pieceValue

    return { piece, captured, isAtRisk }
  } catch {
    return null
  }
}

function cheapestAttackerValue(chess: Chess, squares: string[]): number {
  let cheapest = Number.POSITIVE_INFINITY
  for (const sq of squares) {
    const piece = chess.get(sq as Parameters<Chess['get']>[0])
    if (!piece) continue
    const value = piece.type === 'k' ? KING_AS_ATTACKER_VALUE : PIECE_VALUES[piece.type as PieceSymbol]
    if (value < cheapest) cheapest = value
  }
  return cheapest
}

/**
 * 전체 게임의 포지션 평가 배열로부터 각 수의 분류를 계산.
 *
 * @param fens - 각 포지션의 FEN (length = moves.length + 1), fens[i] = moves[i] 직전 포지션
 * @param positionEvals - 각 포지션의 평가 (length = moves.length + 1)
 * @param moves - 메인라인 수 목록
 */
export function computeClassifications(
  fens: string[],
  positionEvals: EvalScore[],
  moves: MoveResponse[],
): MoveEvaluation[] {
  const evaluations: MoveEvaluation[] = []

  for (let i = 0; i < moves.length; i++) {
    const evalBefore = positionEvals[i]
    const evalAfter = positionEvals[i + 1]
    const fenBefore = fens[i]

    if (!evalBefore || !evalAfter || !fenBefore) continue

    const cpBefore = evalToCp(evalBefore)
    const cpAfter = evalToCp(evalAfter)

    // 백의 수: cpLoss = before - after (백 관점에서 점수가 떨어지면 손실)
    // 흑의 수: cpLoss = after - before (백 관점 점수가 올라가면 흑에게 손실)
    const isWhite = moves[i].color === 'WHITE'
    const cpLoss = Math.max(0, isWhite ? cpBefore - cpAfter : cpAfter - cpBefore)

    const baseClassification = classifyMove(cpLoss)

    // Brilliant는 실수 계열이 아닐 때만 승격 가능
    let classification: MoveClassification | null = baseClassification
    if (baseClassification === null) {
      const context = extractMoveContext(fenBefore, moves[i].san)
      if (context && detectBrilliant({ cpLoss, ...context })) {
        classification = 'brilliant'
      }
    }

    evaluations.push({
      moveIndex: i,
      evalBefore,
      evalAfter,
      cpLoss,
      classification,
    })
  }

  return evaluations
}
