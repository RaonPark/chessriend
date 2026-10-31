import type { GameOutcomeFilter, GameSource, RatingBand, TimeCategory } from '../types/game'

/** 목록 필터 값 (페이지 정보 제외) */
export interface GameFilterValue {
  source?: GameSource
  timeCategory?: TimeCategory
  outcome?: GameOutcomeFilter
  /** 상대 레이팅 구간 */
  ratingBand?: RatingBand
}

export const EMPTY_FILTERS: GameFilterValue = {}

export function hasActiveFilters(f: GameFilterValue): boolean {
  return Boolean(f.source || f.timeCategory || f.outcome || f.ratingBand)
}
