import { useEffect, useId, useRef, useState } from 'react'
import { ApiError } from '@/shared/api/apiClient'

const MAX_LENGTH = 30

interface FolderNameDialogProps {
  open: boolean
  title: string
  confirmLabel: string
  initialName?: string
  /** 선택한 게임 수. 1 이상이면 "선택한 게임 N개를 이 폴더에 넣기" 체크 표시 */
  selectedGameCount?: number
  isPending?: boolean
  /** 실패하면 reject — 409면 이름 중복 안내 */
  onSubmit: (name: string, includeSelected: boolean) => Promise<unknown>
  onClose: () => void
}

/** 새 폴더 / 이름 변경 공용 다이얼로그 */
export function FolderNameDialog({ open, ...rest }: FolderNameDialogProps) {
  // 열 때마다 입력값을 초기화하도록 내용 부분을 새로 마운트
  return open ? <FolderNameDialogContent {...rest} /> : null
}

function FolderNameDialogContent({
  title,
  confirmLabel,
  initialName = '',
  selectedGameCount = 0,
  isPending,
  onSubmit,
  onClose,
}: Omit<FolderNameDialogProps, 'open'>) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const inputId = useId()
  const [name, setName] = useState(initialName)
  const [includeSelected, setIncludeSelected] = useState(selectedGameCount > 0)
  const [error, setError] = useState<string | null>(null)
  const trimmed = name.trim()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!trimmed) return
    try {
      await onSubmit(trimmed, includeSelected)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? '같은 이름의 폴더가 이미 있어요.' : '저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 m-auto w-full max-w-sm rounded-xl border border-amber-900/20 bg-amber-50 p-0 shadow-2xl backdrop:bg-black/50 dark:border-amber-200/10 dark:bg-gray-800"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>

        <div className="space-y-1.5">
          <label htmlFor={inputId} className="block text-xs font-medium text-amber-700 dark:text-amber-400">
            폴더 이름
          </label>
          <input
            id={inputId}
            autoFocus
            value={name}
            maxLength={MAX_LENGTH}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
          {error ? (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>
          ) : (
            <p className="text-[11px] text-gray-400 dark:text-gray-500">최대 {MAX_LENGTH}자 · 같은 이름의 폴더는 만들 수 없어요</p>
          )}
        </div>

        {selectedGameCount > 0 && (
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={includeSelected}
              onChange={(e) => setIncludeSelected(e.target.checked)}
              className="h-4 w-4 rounded border-amber-300 accent-amber-700"
            />
            선택한 게임 {selectedGameCount}개를 이 폴더에 넣기
          </label>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!trimmed || isPending}
            className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-40"
          >
            {isPending ? '저장 중...' : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  )
}
