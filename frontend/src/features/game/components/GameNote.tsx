import { useRef, useState } from 'react'
import { useUpdateGameNote } from '../api/mutations'

const MAX_NICKNAME = 50
const MAX_MEMO = 2000

interface GameNoteProps {
  gameId: string
  nickname: string | null | undefined
  memo: string | null | undefined
}

/**
 * 상세 화면 맨 위의 게임 애칭 (보기 ↔ 수정).
 * 애칭·메모는 한 번에 저장하는 API라, 애칭만 바꿀 때도 기존 메모를 함께 보낸다.
 * 입력칸은 비제어(uncontrolled) — 입력 중 리렌더가 값을 덮어써 한글 조합이 깨지지 않게.
 */
export function GameNicknameHeader({ gameId, nickname, memo }: GameNoteProps) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const update = useUpdateGameNote(gameId)

  async function save() {
    await update.mutateAsync({ nickname: inputRef.current?.value ?? '', memo: memo ?? null })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          aria-label="게임 애칭"
          autoFocus
          defaultValue={nickname ?? ''}
          maxLength={MAX_NICKNAME}
          placeholder="예: 에버그린, 첫 퀸 희생 승리"
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return
            if (e.key === 'Enter') void save()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-lg font-semibold text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={update.isPending}
          className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
        >
          {update.isPending ? '저장 중...' : '저장'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          취소
        </button>
      </div>
    )
  }

  if (!nickname) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-lg border border-dashed border-amber-300 px-3 py-1 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-gray-600 dark:text-amber-400 dark:hover:bg-gray-800"
      >
        + 게임 이름 붙이기
      </button>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <h1 className="truncate text-2xl font-bold text-amber-900 dark:text-amber-100">{nickname}</h1>
      <button
        type="button"
        aria-label="애칭 수정"
        onClick={() => setEditing(true)}
        className="shrink-0 rounded-md px-1.5 py-0.5 text-sm text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-gray-700"
      >
        ✎
      </button>
    </div>
  )
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
