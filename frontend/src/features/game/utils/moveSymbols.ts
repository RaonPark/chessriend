import type { MoveClassification } from '../types/game'

/** 기보 표기 기호 (수 목록·대국자 바 공용) */
export const MOVE_SYMBOLS: Record<MoveClassification, { symbol: string; label: string; className: string }> = {
  brilliant: { symbol: '!!', label: 'Brilliant', className: 'text-cyan-600 dark:text-cyan-400' },
  only: { symbol: '!', label: 'Only move', className: 'text-sky-600 dark:text-sky-400' },
  blunder: { symbol: '??', label: 'Blunder', className: 'text-red-600 dark:text-red-400' },
  mistake: { symbol: '?', label: 'Mistake', className: 'text-orange-600 dark:text-orange-400' },
  inaccuracy: { symbol: '?!', label: 'Inaccuracy', className: 'text-yellow-600 dark:text-yellow-400' },
}

/**
 * 흥미로운 수(!?) — 엔진 분류가 아니라 사용자가 직접 붙이는 표시라 MOVE_SYMBOLS와 분리.
 * 색: fuchsia — 엔진 기호(cyan·sky·red·orange·yellow)와 앱 테마(amber)·변형선(indigo·emerald) 어느 것과도 겹치지 않는다.
 */
export const INTERESTING_MARK = {
  symbol: '!?',
  label: '흥미로운 수',
  className: 'text-fuchsia-600 dark:text-fuchsia-400',
  bgClassName: 'bg-fuchsia-100 dark:bg-fuchsia-900/30',
} as const

/** 대국자 바 등 요약 표시 순서 */
export const MOVE_SYMBOL_ORDER: readonly MoveClassification[] = ['brilliant', 'only', 'blunder', 'mistake', 'inaccuracy']
