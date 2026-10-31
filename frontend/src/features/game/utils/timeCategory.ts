import type { TimeCategory } from '../types/game'

/** 시간 분류 한글 이름 (필터·목록·상세 공용) */
export const TIME_CATEGORY_LABELS: Record<TimeCategory, string> = {
  ULTRABULLET: '울트라불릿',
  BULLET: '불릿',
  BLITZ: '블리츠',
  RAPID: '래피드',
  CLASSICAL: '클래시컬',
  CORRESPONDENCE: '일일 체스',
  OTHER: '기타',
}

/** 시간 제한 표시: "10+5 (래피드)". 시간 정보가 없는 '기타'는 이름만 */
export function formatTimeControl(timeControl: { time: string; category: string }): string {
  const label = TIME_CATEGORY_LABELS[timeControl.category as TimeCategory] ?? timeControl.category
  return timeControl.category === 'OTHER' ? label : `${timeControl.time} (${label})`
}
