import type { GameOutcomeFilter, GameSource, RatingBand, TimeCategory } from '../types/game'
import type { GameFilterValue } from '../utils/gameFilters'

const SOURCES: { value: GameSource; label: string }[] = [
  { value: 'LICHESS', label: 'Lichess' },
  { value: 'CHESS_COM', label: 'Chess.com' },
]

const TIME_CATEGORIES: { value: TimeCategory; label: string }[] = [
  { value: 'ULTRABULLET', label: '울트라불릿' },
  { value: 'BULLET', label: '불릿' },
  { value: 'BLITZ', label: '블리츠' },
  { value: 'RAPID', label: '래피드' },
  { value: 'CLASSICAL', label: '클래시컬' },
  // 통신 체스(lichess Correspondence / chess.com Daily) + 시간 정보가 없거나 해석 못 한 PGN 게임
  { value: 'CORRESPONDENCE', label: '기타' },
]

const OUTCOMES: { value: GameOutcomeFilter; label: string }[] = [
  { value: 'WIN', label: '승리' },
  { value: 'LOSS', label: '패배' },
  { value: 'DRAW', label: '무승부' },
]

const RATING_BANDS: { value: RatingBand; label: string }[] = [
  { value: 'UNDER_1200', label: '~1199' },
  { value: 'FROM_1200_TO_1499', label: '1200–1499' },
  { value: 'FROM_1500_TO_1799', label: '1500–1799' },
  { value: 'FROM_1800_TO_2099', label: '1800–2099' },
  { value: 'FROM_2100', label: '2100+' },
  { value: 'UNRATED', label: '레이팅 없음' },
]

interface GameFiltersProps {
  value: GameFilterValue
  onChange: (next: GameFilterValue) => void
  /** 지정하면 카드 오른쪽 위에 "필터 초기화" 버튼 표시 (필터가 걸려 있을 때만 넘김) */
  onReset?: () => void
}

/** 게임 목록 필터 (시안 A: 모든 조건을 버튼 줄로 펼침) */
export function GameFilters({ value, onChange, onReset }: GameFiltersProps) {
  const set = (patch: Partial<GameFilterValue>) => onChange({ ...value, ...patch })

  return (
    <div className="relative space-y-2.5 rounded-xl border border-amber-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      {onReset && (
        // 좁은 화면에서는 첫 줄 버튼과 겹치므로 별도 줄로, sm 이상에서만 카드 오른쪽 위에 겹쳐 둠
        <div className="flex justify-end sm:absolute sm:right-3 sm:top-3">
          <button
            type="button"
            onClick={onReset}
            className="rounded-md px-2 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-gray-700"
          >
            필터 초기화
          </button>
        </div>
      )}
      <FilterRow label="플랫폼" options={SOURCES} selected={value.source} onSelect={(source) => set({ source })} />
      <FilterRow label="시간" options={TIME_CATEGORIES} selected={value.timeCategory} onSelect={(timeCategory) => set({ timeCategory })} />
      <FilterRow label="결과" options={OUTCOMES} selected={value.outcome} onSelect={(outcome) => set({ outcome })} />
      <FilterRow label="상대 레이팅" options={RATING_BANDS} selected={value.ratingBand} onSelect={(ratingBand) => set({ ratingBand })} />
    </div>
  )
}

interface FilterRowProps<T extends string> {
  label: string
  options: { value: T; label: string }[]
  selected: T | undefined
  onSelect: (value: T | undefined) => void
}

function FilterRow<T extends string>({ label, options, selected, onSelect }: FilterRowProps<T>) {
  const all: { value: T | undefined; label: string }[] = [{ value: undefined, label: '전체' }, ...options]
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-16 shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-400">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {all.map((option) => {
          const checked = selected === option.value
          return (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onSelect(option.value)}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${
                checked
                  ? 'border-amber-700 bg-amber-700 text-white dark:border-amber-600 dark:bg-amber-600'
                  : 'border-amber-200 bg-white text-amber-800 hover:bg-amber-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
