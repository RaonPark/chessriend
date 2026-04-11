import { useEffect } from 'react'
import { useBoardStore } from '../stores/boardStore'
import { GameBoard } from './GameBoard'
import { MoveList } from './MoveList'
import { BoardControls } from './BoardControls'
import type { MoveResponse } from '../types/game'

interface GameViewerProps {
  moves: MoveResponse[]
  ownerUsername: string
  whiteName: string
}

export function GameViewer({ moves, ownerUsername, whiteName }: GameViewerProps) {
  const loadMoves = useBoardStore((s) => s.loadMoves)

  // owner가 흑이면 보드를 뒤집어서 표시
  const isOwnerBlack = ownerUsername.toLowerCase() !== whiteName.toLowerCase()
  const orientation = isOwnerBlack ? 'black' : 'white'

  useEffect(() => {
    loadMoves(moves)
  }, [moves, loadMoves])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row">
        {/* 체스보드 */}
        <div className="w-full md:w-1/2 lg:w-[480px]">
          <GameBoard orientation={orientation} />
        </div>

        {/* 수 목록 */}
        <div className="flex-1">
          <MoveList />
        </div>
      </div>

      {/* 네비게이션 */}
      <BoardControls />
    </div>
  )
}
