import { useEffect, useRef } from 'react'
import { useBoardStore } from '../stores/boardStore'

export function MoveList() {
  const moves = useBoardStore((s) => s.moves)
  const currentIndex = useBoardStore((s) => s.currentIndex)
  const goToMove = useBoardStore((s) => s.goToMove)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [currentIndex])

  // 수를 쌍으로 그룹핑 (1. e4 e5  2. Nf3 Nc6 ...)
  const pairs: { number: number; white?: { san: string; index: number }; black?: { san: string; index: number } }[] = []

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i]
    if (move.color === 'WHITE') {
      pairs.push({ number: move.number, white: { san: move.san, index: i } })
    } else {
      const last = pairs[pairs.length - 1]
      if (last && last.number === move.number) {
        last.black = { san: move.san, index: i }
      } else {
        pairs.push({ number: move.number, black: { san: move.san, index: i } })
      }
    }
  }

  return (
    <div className="max-h-96 overflow-y-auto rounded-xl border border-amber-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="grid grid-cols-[2.5rem_1fr_1fr] text-sm">
        {/* 헤더 */}
        <div className="sticky top-0 border-b border-amber-100 bg-amber-50 px-2 py-1.5 text-center text-xs font-medium text-amber-600 dark:border-gray-700 dark:bg-gray-800 dark:text-amber-400">#</div>
        <div className="sticky top-0 border-b border-amber-100 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-600 dark:border-gray-700 dark:bg-gray-800 dark:text-amber-400">백</div>
        <div className="sticky top-0 border-b border-amber-100 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-600 dark:border-gray-700 dark:bg-gray-800 dark:text-amber-400">흑</div>

        {pairs.map((pair) => (
          <MoveRow key={pair.number} pair={pair} currentIndex={currentIndex} goToMove={goToMove} activeRef={activeRef} />
        ))}
      </div>
    </div>
  )
}

function MoveRow({ pair, currentIndex, goToMove, activeRef }: {
  pair: { number: number; white?: { san: string; index: number }; black?: { san: string; index: number } }
  currentIndex: number
  goToMove: (index: number) => void
  activeRef: React.RefObject<HTMLButtonElement | null>
}) {
  return (
    <>
      <div className="px-2 py-1 text-center text-xs text-amber-500 dark:text-gray-500">
        {pair.number}.
      </div>
      <MoveCell
        move={pair.white}
        isActive={pair.white?.index === currentIndex}
        goToMove={goToMove}
        activeRef={activeRef}
      />
      <MoveCell
        move={pair.black}
        isActive={pair.black?.index === currentIndex}
        goToMove={goToMove}
        activeRef={activeRef}
      />
    </>
  )
}

function MoveCell({ move, isActive, goToMove, activeRef }: {
  move?: { san: string; index: number }
  isActive: boolean
  goToMove: (index: number) => void
  activeRef: React.RefObject<HTMLButtonElement | null>
}) {
  if (!move) return <div />

  return (
    <button
      ref={isActive ? activeRef : undefined}
      onClick={() => goToMove(move.index)}
      className={`px-2 py-1 text-left text-sm transition ${
        isActive
          ? 'bg-amber-200 font-semibold text-amber-900 dark:bg-amber-800 dark:text-amber-100'
          : 'text-gray-700 hover:bg-amber-50 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
    >
      {move.san}
    </button>
  )
}
