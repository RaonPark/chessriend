interface AnalysisProgressProps {
  current: number
  total: number
  onCancel: () => void
}

export function AnalysisProgress({ current, total, onCancel }: AnalysisProgressProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
          게임 분석 중: {current}/{total} 포지션
        </span>
        <button
          onClick={onCancel}
          className="rounded px-2 py-0.5 text-xs font-medium text-red-500 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          취소
        </button>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-amber-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-amber-600 transition-all duration-300 dark:bg-amber-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-1 text-right text-[10px] text-amber-500 dark:text-gray-500">
        {percent}%
      </div>
    </div>
  )
}
