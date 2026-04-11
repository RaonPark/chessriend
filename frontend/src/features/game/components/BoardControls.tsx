import { useEffect } from 'react'
import { useBoardStore } from '../stores/boardStore'

export function BoardControls() {
  const currentIndex = useBoardStore((s) => s.currentIndex)
  const moves = useBoardStore((s) => s.moves)
  const goToStart = useBoardStore((s) => s.goToStart)
  const goPrev = useBoardStore((s) => s.goPrev)
  const goNext = useBoardStore((s) => s.goNext)
  const goToEnd = useBoardStore((s) => s.goToEnd)

  const isStart = currentIndex < 0
  const isEnd = currentIndex >= moves.length - 1

  // 키보드 네비게이션
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
      if (e.key === 'Home') { e.preventDefault(); goToStart() }
      if (e.key === 'End') { e.preventDefault(); goToEnd() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goPrev, goNext, goToStart, goToEnd])

  const btnClass = 'rounded-lg border border-amber-200 px-3 py-2 text-sm font-medium transition hover:bg-amber-100 disabled:opacity-30 disabled:hover:bg-transparent dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'

  return (
    <div className="flex items-center justify-center gap-2">
      <button onClick={goToStart} disabled={isStart} className={btnClass} title="처음으로 (Home)">
        &#9198;
      </button>
      <button onClick={goPrev} disabled={isStart} className={btnClass} title="이전 수 (←)">
        &#9194;
      </button>
      <span className="min-w-[4rem] text-center text-sm text-amber-700 dark:text-amber-400">
        {currentIndex < 0 ? '시작' : `${moves[currentIndex].number}. ${moves[currentIndex].san}`}
      </span>
      <button onClick={goNext} disabled={isEnd} className={btnClass} title="다음 수 (→)">
        &#9193;
      </button>
      <button onClick={goToEnd} disabled={isEnd} className={btnClass} title="마지막으로 (End)">
        &#9197;
      </button>
    </div>
  )
}
