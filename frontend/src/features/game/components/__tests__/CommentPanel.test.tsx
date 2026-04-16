import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { useBoardStore } from '../../stores/boardStore'
import { CommentPanel } from '../CommentPanel'
import type { MoveResponse } from '../../types/game'

const SAMPLE_MOVES: MoveResponse[] = [
  { number: 1, color: 'WHITE', san: 'e4' },
  { number: 1, color: 'BLACK', san: 'e5' },
  { number: 2, color: 'WHITE', san: 'Nf3' },
]

function renderPanel() {
  return renderWithProviders(<CommentPanel />)
}

describe('CommentPanel', () => {
  beforeEach(() => {
    useBoardStore.getState().loadMoves(SAMPLE_MOVES)
  })

  it('초기 포지션(currentIndex=-1)에서는 렌더링하지 않는다', () => {
    const { container } = renderPanel()
    expect(container.innerHTML).toBe('')
  })

  it('수를 선택하면 메모 입력 버튼을 표시한다', () => {
    useBoardStore.getState().goToMove(0)
    renderPanel()

    expect(screen.getByText('1. e4')).toBeInTheDocument()
    expect(screen.getByText('메모 추가...')).toBeInTheDocument()
  })

  it('메모 추가 클릭 시 편집 모드로 전환한다', async () => {
    useBoardStore.getState().goToMove(0)
    renderPanel()

    await userEvent.click(screen.getByText('메모 추가...'))

    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByText('저장')).toBeInTheDocument()
    expect(screen.getByText('취소')).toBeInTheDocument()
  })

  it('저장 버튼으로 메모를 저장한다', async () => {
    useBoardStore.getState().goToMove(0)
    renderPanel()

    await userEvent.click(screen.getByText('메모 추가...'))
    await userEvent.type(screen.getByRole('textbox'), '좋은 수')
    await userEvent.click(screen.getByText('저장'))

    expect(useBoardStore.getState().moveComments['0']).toBe('좋은 수')
  })

  it('취소 버튼으로 편집을 취소한다', async () => {
    useBoardStore.getState().goToMove(0)
    renderPanel()

    await userEvent.click(screen.getByText('메모 추가...'))
    await userEvent.type(screen.getByRole('textbox'), '임시 텍스트')
    await userEvent.click(screen.getByText('취소'))

    expect(useBoardStore.getState().moveComments['0']).toBeUndefined()
    expect(screen.getByText('메모 추가...')).toBeInTheDocument()
  })

  it('기존 메모가 있는 수를 선택하면 메모 내용을 표시한다', () => {
    useBoardStore.getState().goToMove(0)
    useBoardStore.getState().setMoveComment(0, '기존 메모')
    renderPanel()

    expect(screen.getByText('기존 메모')).toBeInTheDocument()
    expect(screen.getByText('메모 있음')).toBeInTheDocument()
  })

  it('변형선 모드에서는 렌더링하지 않는다', () => {
    useBoardStore.getState().goToMove(0)
    useBoardStore.getState().makeMove('d7', 'd5', undefined) // variation 시작
    expect(useBoardStore.getState().isInVariation).toBe(true)

    const { container } = renderPanel()
    expect(container.innerHTML).toBe('')
  })

  it('textarea에 올바른 aria-label을 설정한다', async () => {
    useBoardStore.getState().goToMove(0)
    renderPanel()

    await userEvent.click(screen.getByText('메모 추가...'))

    expect(screen.getByLabelText('1. e4 메모')).toBeInTheDocument()
  })
})
