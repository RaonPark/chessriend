import { useRef, useState } from 'react'
import { useUpdateGameNote } from '../api/mutations'

const MAX_MEMO = 2000

interface GameNoteProps {
  gameId: string
  nickname: string | null | undefined
  memo: string | null | undefined
}

/** 상세 화면 맨 위의 게임 이름(애칭) — 표시만. 이름 변경은 게임 목록에서 우클릭 → "게임 이름 변경" */
export function GameNicknameHeader({ nickname }: { nickname: string | null | undefined }) {
  if (!nickname) return null
  return <h1 className="truncate text-2xl font-bold text-amber-900 dark:text-amber-100">{nickname}</h1>
}

/** "경기 정보" 탭의 게임 메모 (보기 ↔ 수정). 애칭은 기존 값을 함께 보낸다. */
export function GameMemoSection({ gameId, nickname, memo }: GameNoteProps) {
  const [editing, setEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const update = useUpdateGameNote(gameId)

  async function save() {
    await update.mutateAsync({ nickname: nickname ?? null, memo: textareaRef.current?.value ?? '' })
    setEditing(false)
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-amber-700 dark:text-amber-400">게임 메모</h3>
        {memo && !editing && (
          <button
            type="button"
            aria-label="메모 수정"
            onClick={() => setEditing(true)}
            className="rounded-md px-1.5 text-sm text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-gray-700"
          >
            ✎
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            aria-label="게임 메모"
            autoFocus
            rows={4}
            maxLength={MAX_MEMO}
            defaultValue={memo ?? ''}
            placeholder="이 게임에서 기억하고 싶은 것 — 흐름, 배운 점, 다음에 시도할 것"
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return
              if (e.key === 'Escape') setEditing(false)
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void save()
            }}
            className="w-full resize-y rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-amber-500 dark:text-gray-500">Ctrl+Enter 저장 · Esc 취소</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={update.isPending}
                className="rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-700 dark:hover:bg-amber-600"
              >
                {update.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : memo ? (
        <p className="whitespace-pre-wrap text-sm text-gray-900 dark:text-white">{memo}</p>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full rounded-lg border border-dashed border-amber-300 px-3 py-2 text-left text-sm text-amber-500 hover:bg-amber-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-900"
        >
          게임 메모 추가
        </button>
      )}
    </section>
  )
}
