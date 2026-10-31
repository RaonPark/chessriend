interface OutcomeGame {
  ownerUsername: string
  white: { name: string }
  black: { name: string }
  result: string
}

export type OwnerOutcome = 'win' | 'loss' | 'draw'

/**
 * 소유자(owner) 관점의 승/패/무. owner가 양쪽 플레이어 중 누구와도 매칭되지 않으면 null
 * (FEN/PGN 등 소유자 없는 게임) — 이 경우 중립 결과 라벨([getResultLabel])을 쓴다.
 */
export function getOwnerOutcome(game: OutcomeGame): OwnerOutcome | null {
  const owner = game.ownerUsername.trim().toLowerCase()
  if (!owner) return null
  const isWhite = game.white.name.toLowerCase() === owner
  const isBlack = game.black.name.toLowerCase() === owner
  if (!isWhite && !isBlack) return null

  if (game.result === '1/2-1/2') return 'draw'
  if (game.result === '1-0') return isWhite ? 'win' : 'loss'
  if (game.result === '0-1') return isBlack ? 'win' : 'loss'
  return 'draw'
}

/** 소유자 무관 중립 결과 라벨. */
export function getResultLabel(result: string): string {
  switch (result) {
    case '1-0':
      return '백 승'
    case '0-1':
      return '흑 승'
    case '1/2-1/2':
      return '무승부'
    default:
      return '진행 중'
  }
}

export interface PlayerBadge {
  text: string
  tone: OwnerOutcome
}

const OUTCOME_TEXT: Record<OwnerOutcome, string> = { win: '승리', loss: '패배', draw: '무승부' }

/**
 * 대국자 바에 붙일 결과 배지.
 * - 소유자가 있으면 소유자 쪽에만 소유자 관점 승/패/무 (예: "승리 (1-0)")
 * - 소유자가 없으면 이긴 쪽에 "승리", 무승부면 양쪽 모두 "무승부"
 */
export function getPlayerBadge(game: OutcomeGame, color: 'white' | 'black'): PlayerBadge | null {
  const outcome = getOwnerOutcome(game)
  if (outcome) {
    const owner = game.ownerUsername.trim().toLowerCase()
    const isOwnerSide = game[color].name.toLowerCase() === owner
    return isOwnerSide ? { text: `${OUTCOME_TEXT[outcome]} (${game.result})`, tone: outcome } : null
  }
  if (game.result === '1/2-1/2') return { text: '무승부', tone: 'draw' }
  const winner = game.result === '1-0' ? 'white' : game.result === '0-1' ? 'black' : null
  return winner === color ? { text: `승리 (${game.result})`, tone: 'win' } : null
}
