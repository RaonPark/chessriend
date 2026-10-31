/** ply(0 = 백의 첫 수) → "2.Nf3"(백) / "2...Bc5"(흑) */
export function formatNumberedMove(ply: number, san: string): string {
  const moveNumber = Math.floor(ply / 2) + 1
  return ply % 2 === 0 ? `${moveNumber}.${san}` : `${moveNumber}...${san}`
}

/**
 * 변형선 j번째 수의 ply.
 * 변형선은 메인라인 startMoveIndex 수 "이후" 포지션에서 시작한다 (-1 = 초기 포지션).
 */
export function variationMovePly(startMoveIndex: number, indexInVariation: number): number {
  return startMoveIndex + 1 + indexInVariation
}
