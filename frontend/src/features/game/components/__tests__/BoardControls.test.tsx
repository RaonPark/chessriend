import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BoardControls } from '../BoardControls'
import { useBoardStore } from '../../stores/boardStore'

const MOVES = [
  { number: 1, color: 'WHITE' as const, san: 'e4' },
  { number: 1, color: 'BLACK' as const, san: 'e5' },
]

function renderWithDialog() {
  return render(
    <>
      <BoardControls />
      <dialog open>
        <button>다이얼로그 안 버튼</button>
      </dialog>
    </>,
  )
}

describe('BoardControls 키보드 단축키', () => {
  beforeEach(() => {
    useBoardStore.getState().loadMoves(MOVES)
    useBoardStore.getState().setAnalysis({ evaluations: [], depth: 18, analyzedAt: '' })
    useBoardStore.getState().goToMove(0)
  })

  it('보드에서 Escape를 누르면 변형선을 나간다', async () => {
    useBoardStore.getState().makeMove('d7', 'd5')
    render(<BoardControls />)

    await userEvent.keyboard('{Escape}')

    expect(useBoardStore.getState().isInVariation).toBe(false)
  })

  it('다이얼로그 안에서 누른 Escape는 변형선을 나가지 않는다', async () => {
    useBoardStore.getState().makeMove('d7', 'd5')
    renderWithDialog()
    screen.getByText('다이얼로그 안 버튼').focus()

    await userEvent.keyboard('{Escape}')

    expect(useBoardStore.getState().isInVariation).toBe(true)
  })

  it('다이얼로그 안에서 누른 방향키는 수를 이동하지 않는다', async () => {
    renderWithDialog()
    screen.getByText('다이얼로그 안 버튼').focus()

    await userEvent.keyboard('{ArrowRight}')

    expect(useBoardStore.getState().currentIndex).toBe(0)
  })
})
