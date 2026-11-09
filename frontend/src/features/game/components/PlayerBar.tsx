import { ChessKing } from '@/shared/components/ChessKing'
import type { PlayerBadge } from '../utils/outcome'
import type { SideStats } from '../utils/analysisStats'
import { CpLossHelp } from './AnalysisSummary'
import { MOVE_SYMBOLS, MOVE_SYMBOL_ORDER } from '../utils/moveSymbols'
import { formatClock } from '../utils/clock'

interface PlayerBarProps {
  color: 'white' | 'black'
  name: string
  rating: number | null
  badge: PlayerBadge | null
  /** 분석 완료 후 이 플레이어의 요약 (없으면 표시 안 함) */
  stats: SideStats | null
  /** 현재 포지션에서 이 플레이어의 남은 시계 (ms). 시계 정보가 없으면 null/생략 */
  clockMs?: number | null
  /** 이 플레이어가 둘 차례인지 (시계 강조) */
  isToMove?: boolean
}

const BADGE_TONE: Record<PlayerBadge['tone'], string> = {
  win: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  loss: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  draw: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
}

/** 보드 위/아래에 붙는 대국자 바 (lichess / chess.com 스타일) */
export function PlayerBar({ color, name, rating, badge, stats, clockMs = null, isToMove = false }: PlayerBarProps) {
  return (
    <div
      data-testid={`player-bar-${color}`}
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-amber-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex min-w-0 items-center gap-2">
        <ChessKing color={color} size={20} />
        <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{name}</span>
        {rating != null && <span className="text-xs text-amber-700 dark:text-amber-400">{rating}</span>}
        {badge && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE_TONE[badge.tone]}`}>
            {badge.text}
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {stats && (
          <div className="flex items-center gap-3 text-[11px] text-gray-600 dark:text-gray-300">
            {MOVE_SYMBOL_ORDER.map((kind) => (
              <span
                key={kind}
                aria-label={`${MOVE_SYMBOLS[kind].label} ${stats.counts[kind]}`}
                title={MOVE_SYMBOLS[kind].label}
                className="inline-flex items-baseline gap-0.5"
              >
                <b className={`font-bold ${MOVE_SYMBOLS[kind].className}`}>{MOVE_SYMBOLS[kind].symbol}</b>
                <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{stats.counts[kind]}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              cp loss
              <span data-testid={`player-acpl-${color}`} className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {stats.acpl ?? '-'}
              </span>
              <CpLossHelp />
            </span>
          </div>
        )}
        {clockMs != null && (
          <span
            data-testid={`player-clock-${color}`}
            aria-label={`남은 시간 ${formatClock(clockMs)}${isToMove ? ' (둘 차례)' : ''}`}
            className={`rounded-md px-2 py-0.5 font-mono text-sm font-semibold tabular-nums ${
              isToMove
                ? 'bg-amber-600 text-white dark:bg-amber-600'
                : 'bg-amber-50 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            {formatClock(clockMs)}
          </span>
        )}
      </div>
    </div>
  )
}
