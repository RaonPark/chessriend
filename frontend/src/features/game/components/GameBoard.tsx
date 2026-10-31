import { useCallback, useMemo, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { useBoardStore, selectCurrentArrows } from '../stores/boardStore'
import { buildMoveHintStyles, getLegalTargets } from '../utils/moveHints'
import { ARROW_COLORS, BEST_MOVE_ARROW_COLOR, arrowColorFor, bestMoveArrow, dedupeArrows } from '../utils/arrows'
import type { BoardArrow } from '../types/game'

interface GameBoardProps {
  orientation?: 'white' | 'black'
  /** 엔진 최선수 (UCI). 있으면 파란 화살표로 표시 */
  bestMove?: string | null
}

export function GameBoard({ orientation = 'white', bestMove = null }: GameBoardProps) {
  const currentFen = useBoardStore((s) => s.currentFen)
  const makeMove = useBoardStore((s) => s.makeMove)
  const savedArrows = useBoardStore(selectCurrentArrows)
  const toggleArrow = useBoardStore((s) => s.toggleArrow)
  const canDrawArrows = useBoardStore((s) => s.analysis !== null)

  // 선택은 선택 당시 FEN과 묶어서 보관 → 포지션이 바뀌면(수 이동/네비게이션) 자동 해제
  const [selection, setSelection] = useState<{ fen: string; square: string } | null>(null)
  const selectedSquare = selection?.fen === currentFen ? selection.square : null

  // 우클릭 드래그 중인 화살표 (미리보기)
  const [drawing, setDrawing] = useState<{ fen: string; start: string; over: string; color: string } | null>(null)
  const activeDrawing = drawing?.fen === currentFen ? drawing : null

  const targets = useMemo(
    () => (selectedSquare ? getLegalTargets(currentFen, selectedSquare) : []),
    [currentFen, selectedSquare],
  )
  const squareStyles = useMemo(
    () => buildMoveHintStyles(selectedSquare, targets),
    [selectedSquare, targets],
  )

  const arrows = useMemo(() => {
    const list: BoardArrow[] = []
    const engine = bestMoveArrow(currentFen, bestMove)
    if (engine) list.push(engine)
    list.push(...savedArrows)
    if (activeDrawing && activeDrawing.start !== activeDrawing.over) {
      list.push({ startSquare: activeDrawing.start, endSquare: activeDrawing.over, color: activeDrawing.color })
    }
    // 우선순위: 그리는 중 > 저장된 화살표 > 엔진 최선수
    return dedupeArrows(list)
  }, [currentFen, bestMove, savedArrows, activeDrawing])

  const selectSquare = useCallback(
    (square: string | null) => setSelection(square ? { fen: currentFen, square } : null),
    [currentFen],
  )

  const handlePieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string, piece: string) => {
      // 프로모션: 폰이 마지막 랭크에 도달하면 퀸으로
      const promotion = piece[1] === 'P' ? 'q' : undefined
      return makeMove(sourceSquare, targetSquare, promotion)
    },
    [makeMove],
  )

  // 클릭으로 두기: 기물 선택 → 표시된 칸 클릭
  const handleSquareClick = useCallback(
    (square: string) => {
      const target = targets.find((t) => t.to === square)
      if (selectedSquare && target) {
        makeMove(selectedSquare, square, target.isPromotion ? 'q' : undefined)
        selectSquare(null)
        return
      }
      if (square === selectedSquare) {
        selectSquare(null)
        return
      }
      // 둘 수 있는 수가 있는 기물만 선택 (상대 기물/빈 칸 클릭 시 선택 해제)
      selectSquare(getLegalTargets(currentFen, square).length > 0 ? square : null)
    },
    [targets, selectedSquare, makeMove, selectSquare, currentFen],
  )

  // 화살표: 우클릭 드래그 (Shift = 초록, Ctrl/Cmd = 빨강)
  // 라이브러리 내장 화살표는 포지션이 바뀌면 지워지고 저장 연동이 어려워 직접 처리한다.
  const handleSquareMouseDown = useCallback(
    (square: string, e: React.MouseEvent) => {
      if (e.button !== 2 || !canDrawArrows) return
      setDrawing({ fen: currentFen, start: square, over: square, color: arrowColorFor(e) })
    },
    [canDrawArrows, currentFen],
  )

  const handleSquareMouseUp = useCallback(
    (square: string, e: React.MouseEvent) => {
      if (e.button !== 2 || !activeDrawing) return
      setDrawing(null)
      if (activeDrawing.start === square) return
      toggleArrow({ startSquare: activeDrawing.start, endSquare: square, color: arrowColorFor(e) })
    },
    [activeDrawing, toggleArrow],
  )

  return (
    <div className="space-y-1.5">
      <div className="aspect-square w-full" onMouseLeave={() => setDrawing(null)}>
        <Chessboard
          options={{
            position: currentFen,
            boardOrientation: orientation,
            allowDragging: true,
            allowDrawingArrows: false,
            arrows,
            boardStyle: {
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            },
            darkSquareStyle: { backgroundColor: '#b58863' },
            lightSquareStyle: { backgroundColor: '#f0d9b5' },
            squareStyles,
            onSquareClick: ({ square }) => handleSquareClick(square),
            onSquareMouseDown: ({ square }, e) => handleSquareMouseDown(square, e),
            onSquareMouseUp: ({ square }, e) => handleSquareMouseUp(square, e),
            onMouseOverSquare: ({ square }) => {
              if (activeDrawing && activeDrawing.over !== square) setDrawing({ ...activeDrawing, over: square })
            },
            onPieceDrag: ({ square }) => {
              if (square) selectSquare(square)
            },
            onPieceDrop: ({ sourceSquare, targetSquare, piece }) => {
              selectSquare(null)
              if (!sourceSquare || !targetSquare) return false
              return handlePieceDrop(sourceSquare, targetSquare, piece.pieceType)
            },
          }}
        />
      </div>
      {canDrawArrows && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-amber-700 dark:text-gray-400">
          <span>우클릭 드래그로 화살표</span>
          <ArrowLegend color={ARROW_COLORS.primary} label="기본" />
          <ArrowLegend color={ARROW_COLORS.secondary} label="Shift" />
          <ArrowLegend color={ARROW_COLORS.tertiary} label="Ctrl" />
          {bestMove && <ArrowLegend color={BEST_MOVE_ARROW_COLOR} label="엔진 최선수" />}
        </p>
      )}
    </div>
  )
}

function ArrowLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
