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
