import { useRef, useState } from 'react'
import { useBoardStore, selectHasUnsavedVariationMoves } from '../stores/boardStore'
import { formatNumberedMove, variationMovePly } from '../utils/moveNumber'

interface CommentPanelProps {
  onPersist?: () => void
  isPersisting?: boolean
}

export function CommentPanel({ onPersist, isPersisting }: CommentPanelProps = {}) {
  const currentIndex = useBoardStore((s) => s.currentIndex)
  const mainlineMoves = useBoardStore((s) => s.mainlineMoves)
  const isInVariation = useBoardStore((s) => s.isInVariation)
  const variationIndex = useBoardStore((s) => s.variationIndex)
  const variationMoves = useBoardStore((s) => s.variationMoves)
  const activeVariationIndex = useBoardStore((s) => s.activeVariationIndex)
  const variationStartIndex = useBoardStore((s) => s.variationStartIndex)
  const moveComments = useBoardStore((s) => s.moveComments)
  const savedVariations = useBoardStore((s) => s.savedVariations)
  const setMoveComment = useBoardStore((s) => s.setMoveComment)
  const setVariationMoveComment = useBoardStore((s) => s.setVariationMoveComment)
  const saveCurrentVariation = useBoardStore((s) => s.saveCurrentVariation)
  // 새 변형선이거나 저장된 변형선을 이어 둔 경우: 메모를 저장하면 변형선도 함께 저장
  const hasUnsavedVariationMoves = useBoardStore(selectHasUnsavedVariationMoves)
  const analysis = useBoardStore((s) => s.analysis)

  // 편집 상태는 편집을 시작한 포지션 키와 묶어서 보관 → 수가 바뀌면 자동으로 편집 종료
  const [editingKey, setEditingKey] = useState<string | null>(null)
  // 입력칸은 비제어(uncontrolled): 입력 중 React가 값을 다시 쓰지 않아야 한글 조합(IME)이 끊기지 않는다.
  // (엔진 평가 등으로 리렌더가 잦음) 저장할 때 ref로 최종 값을 읽는다.
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 현재 수의 메모와 라벨 결정
  const isInSavedVariation = isInVariation && activeVariationIndex >= 0
  // 아직 저장 안 한 변형선: 메모를 저장하면 변형선도 함께 저장한다
  const isInDraftVariation = isInVariation && activeVariationIndex < 0
  let savedComment = ''
  let moveLabel = ''
  let canComment = false
  const variationMoveLabel = () =>
    formatNumberedMove(variationMovePly(variationStartIndex, variationIndex), variationMoves[variationIndex])

  if (isInSavedVariation && variationIndex >= 0) {
    // 저장된 변형선 수의 메모
    const variation = savedVariations[activeVariationIndex]
    savedComment = variation?.moveComments?.[String(variationIndex)] ?? ''
    moveLabel = `변형선 · ${variationMoveLabel()}`
    canComment = true
  } else if (isInDraftVariation && variationIndex >= 0) {
    moveLabel = `새 변형선 · ${variationMoveLabel()}`
    canComment = true
  } else if (!isInVariation && currentIndex >= 0) {
    // 메인라인 수의 메모
    savedComment = moveComments[String(currentIndex)] ?? ''
    const move = mainlineMoves[currentIndex]
    moveLabel = `${move.number}${move.color === 'BLACK' ? '...' : '.'} ${move.san}`
    canComment = true
  }

  const positionKey = `${isInVariation ? `v${activeVariationIndex}:${variationIndex}` : currentIndex}`
  const isEditing = editingKey === positionKey

  if (!analysis) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="text-xs text-amber-400 dark:text-gray-500">게임 분석 이후 메모를 작성할 수 있습니다.</p>
      </div>
    )
  }

  if (!canComment) return null

  function handleSave() {
    const draft = textareaRef.current?.value ?? savedComment
    if (hasUnsavedVariationMoves) {
      // 빈 메모로 변형선만 저장되는 일이 없도록
      if (!draft.trim()) {
        setEditingKey(null)
        return
      }
      saveCurrentVariation()
      setVariationMoveComment(variationIndex, draft)
    } else if (isInSavedVariation) {
      setVariationMoveComment(variationIndex, draft)
    } else {
      setMoveComment(currentIndex, draft)
    }
    setEditingKey(null)
    onPersist?.()
  }

  function handleCancel() {
    setEditingKey(null)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // 보드 단축키(방향키·Esc 등)로 새지 않게
    e.stopPropagation()
    // 한글 조합 중에 누른 키는 입력기에 맡김 — 여기서 저장/취소하면 마지막 글자가 빠지거나 조합이 깨짐
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  // 저장된 변형선 = emerald, 저장 전 변형선 = indigo, 메인라인 = amber (ui.md 시맨틱 색)
  const theme = isInSavedVariation
    ? {
        border: 'border-emerald-200 dark:border-emerald-900',
        bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
        label: 'text-emerald-700 dark:text-emerald-400',
        accent: 'text-emerald-500 dark:text-gray-500',
      }
    : isInDraftVariation
      ? {
          border: 'border-indigo-200 dark:border-indigo-800',
          bg: 'bg-indigo-50/50 dark:bg-indigo-950/20',
          label: 'text-indigo-700 dark:text-indigo-300',
          accent: 'text-indigo-500 dark:text-indigo-400',
        }
      : {
          border: 'border-amber-200 dark:border-gray-700',
          bg: 'bg-amber-50/50 dark:bg-gray-800/50',
          label: 'text-amber-700 dark:text-amber-400',
          accent: 'text-amber-500 dark:text-gray-500',
        }

  return (
    <div className={`rounded-xl border ${theme.border} ${theme.bg} p-3`}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className={`text-xs font-medium ${theme.label}`}>
          {moveLabel}
        </span>
        {savedComment && !isEditing && (
          <span className={`text-[10px] ${theme.accent}`}>메모 있음</span>
        )}
        {hasUnsavedVariationMoves && (
          <span className={`text-[10px] ${theme.accent}`}>메모를 저장하면 변형선도 함께 저장됩니다</span>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            defaultValue={savedComment}
            onKeyDown={handleKeyDown}
            placeholder="이 수에 대한 메모를 작성하세요..."
            aria-label={`${moveLabel} 메모`}
            rows={3}
            autoFocus
            className="w-full resize-none rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-amber-300 focus:border-amber-400 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:placeholder:text-gray-600 dark:focus:border-amber-600"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-amber-400 dark:text-gray-600">
              Ctrl+Enter 저장 · Esc 취소
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={handleCancel}
                className="rounded px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={isPersisting}
                className="rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-700 dark:hover:bg-amber-600"
              >
                {isPersisting ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditingKey(positionKey)}
          className={`w-full whitespace-pre-wrap rounded-lg border border-dashed border-amber-300 px-3 py-2 text-left text-sm transition hover:border-amber-400 hover:bg-white dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-900 ${
            // 저장된 메모는 선명하게, 빈 상태 안내 문구만 흐리게
            savedComment ? 'text-gray-900 dark:text-white' : 'text-amber-400 dark:text-gray-500'
          }`}
        >
          {savedComment || '메모 추가...'}
        </button>
      )}
    </div>
  )
}
