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
  attacker: PieceSymbol
  captured: PieceSymbol
}

/**
 * Brilliant (!!): 더 비싼 기물로 더 싼 기물을 잡았는데 cp 손실이 거의 없는 희생 수.
 */
export function detectBrilliant({ cpLoss, attacker, captured }: BrilliantContext): boolean {
  return (
    PIECE_VALUES[attacker] > PIECE_VALUES[captured]
    && cpLoss < BRILLIANT_CP_TOLERANCE
  )
}

/**
 * FEN에서 SAN 수를 시뮬레이션하여 공격/포획 기물 타입을 추출.
 * 포획이 없으면 null.
 */
function extractCapture(fenBefore: string, san: string): { attacker: PieceSymbol; captured: PieceSymbol } | null {
  try {
    const chess = new Chess(fenBefore)
    const move = chess.move(san)
    if (!move.captured) return null
    return {
      attacker: move.piece as PieceSymbol,
      captured: move.captured as PieceSymbol,
    }
  } catch {
    return null
  }
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
      const capture = extractCapture(fenBefore, moves[i].san)
      if (capture && detectBrilliant({ cpLoss, ...capture })) {
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
