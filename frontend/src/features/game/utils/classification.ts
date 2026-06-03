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

const KING_AS_ATTACKER_VALUE = 0

/**
 * "거의 비슷" 기준 — Win% 손실이 이 값 미만이면 희생이 유효하다고 간주.
 */
const BRILLIANT_WIN_TOLERANCE = 2

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
 * centipawn 평가를 기대 승률(0..100)로 변환.
 */
function winPercent(cp: number): number {
  return 100 / (1 + Math.exp(-0.00368208 * cp))
}

/**
 * Win% loss 기준으로 수를 분류.
 * Blunder: 30%p+, Mistake: 20-30%p, Inaccuracy: 10-20%p
 */
export function classifyMove(winLoss: number): MoveClassification | null {
  if (winLoss >= 30) return 'blunder'
  if (winLoss >= 20) return 'mistake'
  if (winLoss >= 10) return 'inaccuracy'
  return null
}

interface BrilliantContext {
  winLoss: number
  /** 이동한 기물 */
  piece: PieceSymbol
  /** 포획한 기물 (없으면 null — 일반 수) */
  captured: PieceSymbol | null
  /**
   * 이동 후 기물이 잡힐 위치에 놓였는지 여부.
   * 상대 기물이 목적지를 공격하고, 아군 기물이 방어하지 않는 경우.
   */
  isAtRisk: boolean
}

/**
 * Brilliant (!!): 기물을 희생에 놓았음에도 Win% 손실이 거의 없는 수.
 *
 * 희생의 세 유형:
 * 1. **교환 희생**: 비싼 기물로 싼 기물을 잡았고 방어 안 되는 칸에 놓임
 *    (예: Bxf7+ — 비숍 3으로 폰 1 잡고 방어 없이 노출)
 * 2. **공짜 희생 (싼 기물 공격)**: 기물을 더 싼 상대 기물이 공격하는 방어 없는 칸에 놓음
 *    (예: 퀸을 폰이 공격하는 칸에 놓고 잡으면 메이트)
 * 3. **공짜 희생 (비싼 기물 공격)**: 기물을 더 비싼 상대 기물이 공격하는 방어 없는 칸에 놓음
 *    (예: 비숍을 퀸 앞에 놓고 잡으면 백랭크 메이트 — attraction/decoy)
 *
 * 모든 경우 Win% loss < 2%p 이어야 (엔진이 손실을 판단 못 할 만큼 보상이 있어야) brilliant.
 */
export function detectBrilliant({ winLoss, piece, captured, isAtRisk }: BrilliantContext): boolean {
  if (winLoss >= BRILLIANT_WIN_TOLERANCE) return false
  if (!isAtRisk) return false
  // 포획 수의 경우: 공격 기물이 포획 기물보다 비싸야 진짜 희생
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
 * 희생(isAtRisk) 판정:
 * - 상대 기물이 목적지를 이동 기물보다 싼 가치로 공격하고
 * - 아군 기물이 목적지를 방어하지 않는 경우
 * 방어된 기물은 잡히더라도 되잡을 수 있으므로 공짜 희생이 아님.
 */
function extractMoveContext(fenBefore: string, san: string): MoveContext | null {
  try {
    const chess = new Chess(fenBefore)
    const move = chess.move(san)

    const piece = move.piece as PieceSymbol
    const captured = (move.captured ?? null) as PieceSymbol | null

    // chess.move() 이후 turn이 상대로 넘어감 → chess.turn()은 상대 색
    const opponentColor = chess.turn()

    const enemyAttackerSquares = chess.attackers(move.to, opponentColor)
    // 아군 기물이 방어하고 있으면 공짜 희생이 아님
    const myColor = move.color
    const defenders = chess.attackers(move.to, myColor)
    const isDefended = defenders.length > 0

    const cheapestAttacker = enemyAttackerSquares.length > 0
      ? Math.min(...enemyAttackerSquares.map(sq => {
          const p = chess.get(sq as Parameters<Chess['get']>[0])
          return p?.type === 'k'
            ? KING_AS_ATTACKER_VALUE
            : PIECE_VALUES[p?.type as PieceSymbol] ?? Number.POSITIVE_INFINITY
        }))
      : Number.POSITIVE_INFINITY

    const isAtRisk = !isDefended && cheapestAttacker < PIECE_VALUES[piece]

    return { piece, captured, isAtRisk }
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
    const winBefore = winPercent(cpBefore)
    const winAfter = winPercent(cpAfter)

    // 백의 수: cpLoss = before - after (백 관점에서 점수가 떨어지면 손실)
    // 흑의 수: cpLoss = after - before (백 관점 점수가 올라가면 흑에게 손실)
    const isWhite = moves[i].color === 'WHITE'
    const cpLoss = Math.max(0, isWhite ? cpBefore - cpAfter : cpAfter - cpBefore)
    const winLoss = Math.max(0, isWhite ? winBefore - winAfter : winAfter - winBefore)

    const baseClassification = classifyMove(winLoss)

    // Brilliant는 실수 계열이 아닐 때만 승격 가능
    let classification: MoveClassification | null = baseClassification
    if (baseClassification === null) {
      const context = extractMoveContext(fenBefore, moves[i].san)
      if (context && detectBrilliant({ winLoss, ...context })) {
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
