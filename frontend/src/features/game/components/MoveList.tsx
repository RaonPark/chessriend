import { useEffect, useRef } from 'react'
import { useBoardStore } from '../stores/boardStore'

export function MoveList() {
  const moves = useBoardStore((s) => s.mainlineMoves)
  const currentIndex = useBoardStore((s) => s.currentIndex)
  const goToMove = useBoardStore((s) => s.goToMove)
  const isInVariation = useBoardStore((s) => s.isInVariation)
  const variationMoves = useBoardStore((s) => s.variationMoves)
  const variationIndex = useBoardStore((s) => s.variationIndex)
  const variationStartIndex = useBoardStore((s) => s.variationStartIndex)
  const goToVariationMove = useBoardStore((s) => s.goToVariationMove)
  const exitVariation = useBoardStore((s) => s.exitVariation)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [currentIndex, variationIndex])

  // mainline 수를 쌍으로 그룹핑
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

  // 변형선이 삽입될 위치 (분기 지점 바로 다음 row)
  const variationAfterPairIndex = isInVariation
    ? pairs.findIndex((p) =>
        (p.white?.index === variationStartIndex) || (p.black?.index === variationStartIndex)
      )
    : -1

  return (
    <div className="max-h-96 overflow-y-auto rounded-xl border border-amber-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="text-sm">
        {/* 헤더 */}
        <div className="sticky top-0 z-10 grid grid-cols-[2.5rem_1fr_1fr] border-b border-amber-100 bg-amber-50 dark:border-gray-700 dark:bg-gray-800">
          <div className="px-2 py-1.5 text-center text-xs font-medium text-amber-600 dark:text-amber-400">#</div>
          <div className="px-2 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">백</div>
          <div className="px-2 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">흑</div>
        </div>

        {pairs.map((pair, pairIdx) => (
          <div key={pair.number}>
            {/* Mainline row */}
            <div className="grid grid-cols-[2.5rem_1fr_1fr]">
              <div className="px-2 py-1 text-center text-xs text-amber-500 dark:text-gray-500">
                {pair.number}.
              </div>
              <MoveCell
                move={pair.white}
                isActive={!isInVariation && pair.white?.index === currentIndex}
                isBranchPoint={isInVariation && pair.white?.index === variationStartIndex}
                goToMove={goToMove}
                activeRef={activeRef}
              />
              <MoveCell
                move={pair.black}
                isActive={!isInVariation && pair.black?.index === currentIndex}
                isBranchPoint={isInVariation && pair.black?.index === variationStartIndex}
                goToMove={goToMove}
                activeRef={activeRef}
              />
            </div>

            {/* 변형선 인라인 (분기 지점 바로 아래) */}
            {pairIdx === variationAfterPairIndex && isInVariation && variationMoves.length > 0 && (
              <div className="border-y border-indigo-200 bg-indigo-50 px-2 py-2 dark:border-indigo-800 dark:bg-indigo-950/30">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-indigo-500 dark:text-indigo-400">변형선</span>
                  <button
                    onClick={exitVariation}
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
                  >
                    복귀
                  </button>
                </div>
                <div className="flex flex-wrap gap-0.5">
                  {variationMoves.map((san, i) => (
                    <button
                      key={i}
                      ref={i === variationIndex ? activeRef : undefined}
                      onClick={() => goToVariationMove(i)}
                      className={`rounded px-1.5 py-0.5 text-xs transition ${
                        i === variationIndex
                          ? 'bg-indigo-200 font-semibold text-indigo-900 dark:bg-indigo-800 dark:text-indigo-100'
                          : 'text-indigo-700 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-900/30'
                      }`}
                    >
                      {san}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function MoveCell({ move, isActive, isBranchPoint, goToMove, activeRef }: {
  move?: { san: string; index: number }
  isActive: boolean
  isBranchPoint: boolean
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
          : isBranchPoint
            ? 'bg-indigo-100 font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
            : 'text-gray-700 hover:bg-amber-50 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
    >
      {move.san}
    </button>
  )
}
