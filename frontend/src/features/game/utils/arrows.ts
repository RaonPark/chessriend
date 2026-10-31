import { Chess } from 'chess.js'
import type { BoardArrow } from '../types/game'

// react-chessboard 기본 화살표 색과 동일 (lichess 관례: 기본 / Shift / Ctrl)
export const ARROW_COLORS = {
  primary: '#ffaa00',
  secondary: '#4caf50',
  tertiary: '#f44336',
} as const

// 사용자 화살표와 구분되는 엔진 최선수 색
export const BEST_MOVE_ARROW_COLOR = '#3b82f6'

/** 보조키에 따른 화살표 색 (Shift = 초록, Ctrl/Cmd = 빨강) */
export function arrowColorFor(modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): string {
  if (modifiers.shiftKey) return ARROW_COLORS.secondary
  if (modifiers.ctrlKey || modifiers.metaKey) return ARROW_COLORS.tertiary
  return ARROW_COLORS.primary
}

/**
 * 엔진 최선수(UCI)를 화살표로 변환. 현재 포지션에서 둘 수 없는 수면 null.
 * — 포지션이 막 바뀐 직후엔 이전 포지션의 최선수가 잠깐 남아 있을 수 있어 합법성으로 거른다.
 */
export function bestMoveArrow(fen: string, uci: string | null): BoardArrow | null {
  if (!uci || uci.length < 4) return null
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  try {
    const legal = new Chess(fen).moves({ verbose: true }).some((m) => m.from === from && m.to === to)
    if (!legal) return null
  } catch {
    return null
  }
  return { startSquare: from, endSquare: to, color: BEST_MOVE_ARROW_COLOR }
}
