import { ChessKing } from '@/shared/components/ChessKing'
import type { PlayerBadge } from '../utils/outcome'
import type { SideStats } from '../utils/analysisStats'
import { CpLossHelp } from './AnalysisSummary'

interface PlayerBarProps {
  color: 'white' | 'black'
  name: string
  rating: number | null
  badge: PlayerBadge | null
  /** 분석 완료 후 이 플레이어의 요약 (없으면 표시 안 함) */
  stats: SideStats | null
}

const BADGE_TONE: Record<PlayerBadge['tone'], string> = {
  win: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  loss: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  draw: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
}

/** 보드 위/아래에 붙는 대국자 바 (lichess / chess.com 스타일) */
export function PlayerBar({ color, name, rating, badge, stats }: PlayerBarProps) {
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

      {stats && (
        <div className="flex items-center gap-3 text-[11px] text-gray-600 dark:text-gray-300">
          <Stat dotClass="bg-red-500" label="Blunder" value={stats.counts.blunder} />
          <Stat dotClass="bg-orange-500" label="Mistake" value={stats.counts.mistake} />
          <span className="inline-flex items-center gap-1">
            cp loss
            <span data-testid={`player-acpl-${color}`} className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
              {stats.acpl ?? '-'}
            </span>
            <CpLossHelp />
          </span>
        </div>
      )}
    </div>
  )
}

function Stat({ dotClass, label, value }: { dotClass: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {label}
      <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{value}</span>
    </span>
  )
}
