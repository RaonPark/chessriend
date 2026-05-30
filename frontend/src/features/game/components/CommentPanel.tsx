import { useState, useEffect } from 'react'
import { useBoardStore } from '../stores/boardStore'

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
  const moveComments = useBoardStore((s) => s.moveComments)
  const savedVariations = useBoardStore((s) => s.savedVariations)
  const setMoveComment = useBoardStore((s) => s.setMoveComment)
  const setVariationMoveComment = useBoardStore((s) => s.setVariationMoveComment)
  const analysis = useBoardStore((s) => s.analysis)

  const [draft, setDraft] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // 현재 수의 메모와 라벨 결정
  const isInSavedVariation = isInVariation && activeVariationIndex >= 0
  let savedComment = ''
  let moveLabel = ''
  let canComment = false

  if (isInSavedVariation && variationIndex >= 0) {
    // 저장된 변형선 수의 메모
    const variation = savedVariations[activeVariationIndex]
    savedComment = variation?.moveComments?.[String(variationIndex)] ?? ''
    moveLabel = `변형선 · ${variationMoves[variationIndex]}`
    canComment = true
  } else if (!isInVariation && currentIndex >= 0) {
    // 메인라인 수의 메모
    savedComment = moveComments[String(currentIndex)] ?? ''
    const move = mainlineMoves[currentIndex]
    moveLabel = `${move.number}${move.color === 'BLACK' ? '...' : '.'} ${move.san}`
    canComment = true
  }

  // 수가 바뀔 때 draft 동기화
  useEffect(() => {
    setDraft(savedComment)
    setIsEditing(false)
  }, [currentIndex, variationIndex, savedComment])

  if (!analysis) {
    return (
      <div className="border-t border-amber-200 bg-amber-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="text-xs text-amber-400 dark:text-gray-500">게임 분석 이후 메모를 작성할 수 있습니다.</p>
      </div>
    )
  }

  if (!canComment) return null

  function handleSave() {
    if (isInSavedVariation) {
      setVariationMoveComment(variationIndex, draft)
    } else {
      setMoveComment(currentIndex, draft)
    }
    setIsEditing(false)
    onPersist?.()
  }

  function handleCancel() {
    setDraft(savedComment)
    setIsEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
    e.stopPropagation()
  }

  const borderColor = isInSavedVariation
    ? 'border-emerald-200 dark:border-emerald-900'
    : 'border-amber-200 dark:border-gray-700'
  const bgColor = isInSavedVariation
    ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
    : 'bg-amber-50/50 dark:bg-gray-800/50'
  const labelColor = isInSavedVariation
    ? 'text-emerald-700 dark:text-emerald-400'
    : 'text-amber-700 dark:text-amber-400'
  const accentColor = isInSavedVariation
    ? 'text-emerald-500 dark:text-gray-500'
    : 'text-amber-500 dark:text-gray-500'

  return (
    <div className={`border-t ${borderColor} ${bgColor} p-3`}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className={`text-xs font-medium ${labelColor}`}>
          {moveLabel}
        </span>
        {savedComment && !isEditing && (
          <span className={`text-[10px] ${accentColor}`}>메모 있음</span>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
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
          onClick={() => setIsEditing(true)}
          className="w-full rounded-lg border border-dashed border-amber-300 px-3 py-2 text-left text-sm text-amber-400 transition hover:border-amber-400 hover:bg-white dark:border-gray-600 dark:text-gray-500 dark:hover:border-gray-500 dark:hover:bg-gray-900"
        >
          {savedComment || '메모 추가...'}
        </button>
      )}
    </div>
  )
}
