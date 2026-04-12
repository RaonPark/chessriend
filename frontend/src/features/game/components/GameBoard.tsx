import { useCallback } from 'react'
import { Chessboard } from 'react-chessboard'
import { useBoardStore } from '../stores/boardStore'

interface GameBoardProps {
  orientation?: 'white' | 'black'
}

export function GameBoard({ orientation = 'white' }: GameBoardProps) {
  const currentFen = useBoardStore((s) => s.currentFen)
  const makeMove = useBoardStore((s) => s.makeMove)

  const handlePieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string, piece: string) => {
      // 프로모션: 폰이 마지막 랭크에 도달하면 퀸으로
      const promotion = piece[1] === 'P' ? 'q' : undefined
      return makeMove(sourceSquare, targetSquare, promotion)
    },
    [makeMove],
  )

  return (
    <div className="aspect-square w-full">
      <Chessboard
        options={{
          position: currentFen,
          boardOrientation: orientation,
          allowDragging: true,
          boardStyle: {
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          },
          darkSquareStyle: { backgroundColor: '#b58863' },
          lightSquareStyle: { backgroundColor: '#f0d9b5' },
          onPieceDrop: ({ sourceSquare, targetSquare, piece }) => {
            if (!sourceSquare || !targetSquare) return false
            return handlePieceDrop(sourceSquare, targetSquare, piece.pieceType)
          },
        }}
      />
    </div>
  )
}
