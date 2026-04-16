import { useEffect, useRef } from 'react'
import { useBoardStore } from '../stores/boardStore'
import { CommentPanel } from './CommentPanel'
import type { VariationResponse } from '../types/game'

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
  const moveComments = useBoardStore((s) => s.moveComments)
  const savedVariations = useBoardStore((s) => s.savedVariations)
  const enterSavedVariation = useBoardStore((s) => s.enterSavedVariation)
  const deleteSavedVariation = useBoardStore((s) => s.deleteSavedVariation)
  const saveCurrentVariation = useBoardStore((s) => s.saveCurrentVariation)
  const activeVariationIndex = useBoardStore((s) => s.activeVariationIndex)
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

  // 저장된 변형선을 시작 인덱스별로 그룹핑
  const savedVariationsByMove = new Map<number, { variation: VariationResponse; globalIndex: number }[]>()
  savedVariations.forEach((v, i) => {
    const existing = savedVariationsByMove.get(v.startMoveIndex) ?? []
    existing.push({ variation: v, globalIndex: i })
    savedVariationsByMove.set(v.startMoveIndex, existing)
  })

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-amber-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="max-h-96 overflow-y-auto">
        <div className="text-sm">
          {/* 헤더 */}
          <div className="sticky top-0 z-10 grid grid-cols-[2.5rem_1fr_1fr] border-b border-amber-100 bg-amber-50 dark:border-gray-700 dark:bg-gray-800">
            <div className="px-2 py-1.5 text-center text-xs font-medium text-amber-600 dark:text-amber-400">#</div>
            <div className="px-2 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">백</div>
            <div className="px-2 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">흑</div>
          </div>

          {pairs.map((pair, pairIdx) => {
            // 이 pair에 속하는 저장된 변형선
            const whiteVariations = pair.white ? (savedVariationsByMove.get(pair.white.index) ?? []) : []
            const blackVariations = pair.black ? (savedVariationsByMove.get(pair.black.index) ?? []) : []
            const pairSavedVariations = [...whiteVariations, ...blackVariations]

            return (
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
                    hasComment={pair.white != null && String(pair.white.index) in moveComments}
                    goToMove={goToMove}
                    activeRef={activeRef}
                  />
                  <MoveCell
                    move={pair.black}
                    isActive={!isInVariation && pair.black?.index === currentIndex}
                    isBranchPoint={isInVariation && pair.black?.index === variationStartIndex}
                    hasComment={pair.black != null && String(pair.black.index) in moveComments}
                    goToMove={goToMove}
                    activeRef={activeRef}
                  />
                </div>

                {/* 저장된 변형선 (분기 지점 아래) */}
                {!isInVariation && pairSavedVariations.length > 0 && (
                  <div className="border-y border-emerald-200 bg-emerald-50/50 px-2 py-1.5 dark:border-emerald-900 dark:bg-emerald-950/20">
                    {pairSavedVariations.map(({ variation, globalIndex }) => (
                      <SavedVariationLine
                        key={globalIndex}
                        variation={variation}
                        onEnter={() => enterSavedVariation(variation, globalIndex)}
                        onDelete={() => deleteSavedVariation(globalIndex)}
                      />
                    ))}
                  </div>
                )}

                {/* 현재 분석 중인 변형선 (인라인) */}
                {pairIdx === variationAfterPairIndex && isInVariation && variationMoves.length > 0 && (
                  <div className="border-y border-indigo-200 bg-indigo-50 px-2 py-2 dark:border-indigo-800 dark:bg-indigo-950/30">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-medium text-indigo-500 dark:text-indigo-400">변형선</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => saveCurrentVariation()}
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                          title="변형선 저장"
                        >
                          저장
                        </button>
                        <button
                          onClick={exitVariation}
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
                        >
                          복귀
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-0.5">
                      {variationMoves.map((san, i) => {
                        const hasVarComment = activeVariationIndex >= 0
                          && savedVariations[activeVariationIndex]?.moveComments?.[String(i)]
                        return (
                          <button
                            key={i}
                            ref={i === variationIndex ? activeRef : undefined}
                            onClick={() => goToVariationMove(i)}
                            className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs transition ${
                              i === variationIndex
                                ? 'bg-indigo-200 font-semibold text-indigo-900 dark:bg-indigo-800 dark:text-indigo-100'
                                : 'text-indigo-700 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-900/30'
                            }`}
                          >
                            <span>{san}</span>
                            {hasVarComment && (
                              <span className="text-[10px] text-indigo-400 dark:text-indigo-500" title="메모 있음">&#9998;</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 메모 패널 (MoveList 하단) */}
      <CommentPanel />
    </div>
  )
}

function MoveCell({ move, isActive, isBranchPoint, hasComment, goToMove, activeRef }: {
  move?: { san: string; index: number }
  isActive: boolean
  isBranchPoint: boolean
  hasComment: boolean
  goToMove: (index: number) => void
  activeRef: React.RefObject<HTMLButtonElement | null>
}) {
  if (!move) return <div />

  return (
    <button
      ref={isActive ? activeRef : undefined}
      onClick={() => goToMove(move.index)}
      className={`flex items-center gap-1 px-2 py-1 text-left text-sm transition ${
        isActive
          ? 'bg-amber-200 font-semibold text-amber-900 dark:bg-amber-800 dark:text-amber-100'
          : isBranchPoint
            ? 'bg-indigo-100 font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
            : 'text-gray-700 hover:bg-amber-50 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
    >
      <span>{move.san}</span>
      {hasComment && (
        <span className="text-[10px] text-amber-500 dark:text-amber-600" title="메모 있음">&#9998;</span>
      )}
    </button>
  )
}

function SavedVariationLine({ variation, onEnter, onDelete }: {
  variation: VariationResponse
  onEnter: () => void
  onDelete: () => void
}) {
  return (
    <div className="group flex items-center gap-1 py-0.5">
      <button
        onClick={onEnter}
        className="flex flex-wrap gap-0.5 text-xs text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
        title="변형선 보기"
      >
        {variation.moves.map((san, i) => (
          <span key={i} className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/30">
            {san}
            {variation.moveComments?.[String(i)] && (
              <span className="text-[10px] text-emerald-500" title="메모 있음">&#9998;</span>
            )}
          </span>
        ))}
      </button>
      {variation.comment && (
        <span className="ml-1 text-[10px] text-emerald-500 dark:text-emerald-600">{variation.comment}</span>
      )}
      <button
        onClick={onDelete}
        className="ml-auto hidden rounded px-1 py-0.5 text-[10px] text-red-400 hover:bg-red-50 group-hover:block group-focus-within:block dark:text-red-500 dark:hover:bg-red-950/30"
        aria-label="변형선 삭제"
      >
        &#10005;
      </button>
    </div>
  )
}
