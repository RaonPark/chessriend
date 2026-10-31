import { useEffect, useId, useRef } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import type { ThemePreference } from '../utils/theme'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * 설정 다이얼로그 — 페이지를 떠나지 않고(복기 중에도) 열 수 있도록 헤더에서 띄운다.
 * 토글은 즉시 적용·저장되므로 별도 저장 버튼이 없다. Esc / 바깥 클릭 / ✕ 로 닫힘.
 */
export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      // 바깥(backdrop) 클릭 시 닫기 — backdrop 클릭은 dialog 자신이 target
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 m-auto w-full max-w-md rounded-xl border border-amber-900/20 bg-amber-50 p-0 shadow-2xl backdrop:bg-black/50 dark:border-amber-200/10 dark:bg-gray-800"
    >
      <div className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            설정
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="설정 닫기"
            className="rounded-lg px-2 py-1 text-gray-500 transition hover:bg-amber-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            &#10005;
          </button>
        </div>
        <SettingsPanel />
      </div>
    </dialog>
  )
}

function SettingsPanel() {
  const showBestMoveArrow = useSettingsStore((s) => s.showBestMoveArrow)
  const setShowBestMoveArrow = useSettingsStore((s) => s.setShowBestMoveArrow)
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-amber-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/40">
        <h3 className="mb-3 text-xs font-semibold text-amber-700 dark:text-amber-400">화면</h3>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">테마</p>
          <div role="radiogroup" aria-label="테마" className="flex gap-0.5 rounded-lg bg-amber-100 p-0.5 dark:bg-gray-700">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={theme === option.value}
                onClick={() => setTheme(option.value)}
                className={`rounded-md px-3 py-1 text-xs transition ${
                  theme === option.value
                    ? 'bg-white font-semibold text-amber-800 shadow-sm dark:bg-gray-900 dark:text-amber-300'
                    : 'font-medium text-amber-700 hover:bg-amber-50 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="rounded-xl border border-amber-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/40">
        <h3 className="mb-3 text-xs font-semibold text-amber-700 dark:text-amber-400">보드</h3>
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

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
]

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
