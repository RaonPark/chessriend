import type { CSSProperties } from 'react'
import { Chess, type Square } from 'chess.js'

export interface LegalTarget {
  to: string
  isCapture: boolean
  isPromotion: boolean
}

/** 주어진 포지션에서 해당 칸 기물이 둘 수 있는 목적지 목록 (차례가 아니거나 빈 칸이면 빈 배열) */
export function getLegalTargets(fen: string, square: string): LegalTarget[] {
  let moves
  try {
    moves = new Chess(fen).moves({ square: square as Square, verbose: true })
  } catch {
    return []
  }

  // 프로모션은 같은 목적지에 q/r/b/n 4개 수가 생기므로 목적지 기준으로 중복 제거
  const byTarget = new Map<string, LegalTarget>()
  for (const m of moves) {
    if (byTarget.has(m.to)) continue
    byTarget.set(m.to, {
      to: m.to,
      isCapture: m.isCapture() || m.isEnPassant(),
      isPromotion: m.isPromotion(),
    })
  }
  return [...byTarget.values()]
}

// amber 체스 테마 (amber-500 기반)
const SELECTED_STYLE: CSSProperties = { backgroundColor: 'rgba(245, 158, 11, 0.5)' }
const MOVE_DOT_STYLE: CSSProperties = {
  background: 'radial-gradient(circle, rgba(0, 0, 0, 0.2) 25%, transparent 27%)',
  cursor: 'pointer',
}
const CAPTURE_RING_STYLE: CSSProperties = {
  background: 'radial-gradient(circle, transparent 58%, rgba(0, 0, 0, 0.2) 60%)',
  cursor: 'pointer',
}

/** react-chessboard `squareStyles`용: 선택한 칸 하이라이트 + 이동 가능 칸 점/잡기 링 */
export function buildMoveHintStyles(
  selected: string | null,
  targets: LegalTarget[],
): Record<string, CSSProperties> {
  if (!selected) return {}
  const styles: Record<string, CSSProperties> = { [selected]: SELECTED_STYLE }
  for (const t of targets) {
    styles[t.to] = t.isCapture ? CAPTURE_RING_STYLE : MOVE_DOT_STYLE
  }
  return styles
}
