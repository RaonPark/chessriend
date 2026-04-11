import { Chessboard } from 'react-chessboard'
import { useBoardStore } from '../stores/boardStore'

interface GameBoardProps {
  orientation?: 'white' | 'black'
}

export function GameBoard({ orientation = 'white' }: GameBoardProps) {
  const currentFen = useBoardStore((s) => s.currentFen)

  return (
    <div className="aspect-square w-full">
      <Chessboard
        options={{
          position: currentFen,
          boardOrientation: orientation,
          allowDragging: false,
          boardStyle: {
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          },
          darkSquareStyle: { backgroundColor: '#b58863' },
          lightSquareStyle: { backgroundColor: '#f0d9b5' },
        }}
      />
    </div>
  )
}
