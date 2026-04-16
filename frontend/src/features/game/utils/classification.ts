import type { EvalScore, MoveClassification, MoveEvaluation, MoveResponse } from '../types/game'

const MATE_SCORE = 10000

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

/**
 * 전체 게임의 포지션 평가 배열로부터 각 수의 분류를 계산.
 *
 * @param positionEvals - 각 포지션의 평가 (length = moves.length + 1)
 *   positionEvals[0] = 시작 포지션, positionEvals[i+1] = moves[i] 이후 포지션
 * @param moves - 메인라인 수 목록
 */
export function computeClassifications(
  positionEvals: EvalScore[],
  moves: MoveResponse[],
): MoveEvaluation[] {
  const evaluations: MoveEvaluation[] = []

  for (let i = 0; i < moves.length; i++) {
    const evalBefore = positionEvals[i]
    const evalAfter = positionEvals[i + 1]

    if (!evalBefore || !evalAfter) continue

    const cpBefore = evalToCp(evalBefore)
    const cpAfter = evalToCp(evalAfter)

    // 백의 수: cpLoss = before - after (백 관점에서 점수가 떨어지면 손실)
    // 흑의 수: cpLoss = after - before (백 관점 점수가 올라가면 흑에게 손실)
    const isWhite = moves[i].color === 'WHITE'
    const cpLoss = Math.max(0, isWhite ? cpBefore - cpAfter : cpAfter - cpBefore)

    evaluations.push({
      moveIndex: i,
      evalBefore,
      evalAfter,
      cpLoss,
      classification: classifyMove(cpLoss),
    })
  }

  return evaluations
}
