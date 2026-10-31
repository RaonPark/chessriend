import type { GameOutcomeFilter, GameSource, RatingBand, RatingBasis, TimeCategory } from '../types/game'

/** 목록 필터 값 (페이지 정보 제외) */
export interface GameFilterValue {
  source?: GameSource
  timeCategory?: TimeCategory
  outcome?: GameOutcomeFilter
  ratingBand?: RatingBand
  ratingBasis: RatingBasis
}

export const EMPTY_FILTERS: GameFilterValue = { ratingBasis: 'OPPONENT' }

export function hasActiveFilters(f: GameFilterValue): boolean {
  return Boolean(f.source || f.timeCategory || f.outcome || f.ratingBand)
}
