import { useSettingsStore } from '../stores/settingsStore'

export function SettingsPage() {
  const showBestMoveArrow = useSettingsStore((s) => s.showBestMoveArrow)
  const setShowBestMoveArrow = useSettingsStore((s) => s.setShowBestMoveArrow)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-amber-900 dark:text-amber-100">설정</h1>

      <section className="rounded-xl border border-amber-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-sm font-semibold text-amber-700 dark:text-amber-400">보드</h2>
        <ToggleRow
          label="엔진 최선수 화살표"
          description="Stockfish가 찾은 현재 포지션의 최선수를 보드에 파란 화살표로 표시합니다."
          checked={showBestMoveArrow}
          onChange={setShowBestMoveArrow}
        />
      </section>
    </div>
  )
}

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          checked ? 'bg-amber-600 dark:bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
