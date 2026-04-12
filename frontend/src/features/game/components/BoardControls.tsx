import { useEffect } from 'react'
import { useBoardStore } from '../stores/boardStore'

export function BoardControls() {
  const currentIndex = useBoardStore((s) => s.currentIndex)
  const mainlineMoves = useBoardStore((s) => s.mainlineMoves)
  const isInVariation = useBoardStore((s) => s.isInVariation)
  const variationIndex = useBoardStore((s) => s.variationIndex)
  const variationMoves = useBoardStore((s) => s.variationMoves)
  const goToStart = useBoardStore((s) => s.goToStart)
  const goPrev = useBoardStore((s) => s.goPrev)
  const goNext = useBoardStore((s) => s.goNext)
  const goToEnd = useBoardStore((s) => s.goToEnd)
  const exitVariation = useBoardStore((s) => s.exitVariation)

  const isStart = isInVariation ? variationIndex < 0 && currentIndex < 0 : currentIndex < 0
  const isEnd = isInVariation
    ? variationIndex >= variationMoves.length - 1
    : currentIndex >= mainlineMoves.length - 1

  // 키보드 네비게이션
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
      if (e.key === 'ArrowUp') { e.preventDefault(); goToStart() }
      if (e.key === 'ArrowDown') { e.preventDefault(); goToEnd() }
      if (e.key === 'Escape' && isInVariation) { e.preventDefault(); exitVariation() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goPrev, goNext, goToStart, goToEnd, isInVariation, exitVariation])

  // 현재 수 텍스트
  let currentMoveText = '시작'
  if (isInVariation && variationIndex >= 0) {
    currentMoveText = variationMoves[variationIndex]
  } else if (currentIndex >= 0) {
    currentMoveText = `${mainlineMoves[currentIndex].number}. ${mainlineMoves[currentIndex].san}`
  }

  const btnClass = 'rounded-lg border border-amber-200 px-3 py-2 text-sm font-medium transition hover:bg-amber-100 disabled:opacity-30 disabled:hover:bg-transparent dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-2">
        <button onClick={goToStart} disabled={isStart} className={btnClass} title="처음으로 (↑)">
          &#9198;
        </button>
        <button onClick={goPrev} disabled={isStart} className={btnClass} title="이전 수 (←)">
          &#9194;
        </button>
        <span className="min-w-[5rem] text-center text-sm text-amber-700 dark:text-amber-400">
          {currentMoveText}
        </span>
        <button onClick={goNext} disabled={isEnd} className={btnClass} title="다음 수 (→)">
          &#9193;
        </button>
        <button onClick={goToEnd} disabled={isEnd} className={btnClass} title="마지막으로 (↓)">
          &#9197;
        </button>
      </div>

      {isInVariation && (
        <div className="flex justify-center">
          <button
            onClick={exitVariation}
            className="rounded-lg border border-indigo-300 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950"
          >
            원래 기보로 복귀 (Esc)
          </button>
        </div>
      )}
    </div>
  )
}
