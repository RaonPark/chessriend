import { describe, it, expect, beforeEach, vi } from 'vitest'
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

function renderPanel(props?: { onPersist?: () => void; isPersisting?: boolean }) {
  return renderWithProviders(<CommentPanel {...props} />)
}

const DUMMY_ANALYSIS = {
  evaluations: [],
  depth: 16,
  analyzedAt: new Date().toISOString(),
}

describe('CommentPanel', () => {
  beforeEach(() => {
    useBoardStore.getState().loadMoves(SAMPLE_MOVES)
    useBoardStore.getState().setAnalysis(DUMMY_ANALYSIS)
  })

  it('분석 전에는 안내 문구를 표시한다', () => {
    useBoardStore.getState().goToMove(0)
    useBoardStore.setState({ analysis: null, classificationByMove: {} })
    renderPanel()

    expect(screen.getByText('게임 분석 이후 메모를 작성할 수 있습니다.')).toBeInTheDocument()
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

  describe('저장된 변형선을 이어서 둔 경우', () => {
    beforeEach(() => {
      const variation = { startMoveIndex: 0, moves: ['d5'], comment: '', moveComments: {} }
      useBoardStore.getState().loadAnnotations({ moveComments: {}, variations: [variation], analysis: DUMMY_ANALYSIS })
      useBoardStore.getState().enterSavedVariation(useBoardStore.getState().savedVariations[0], 0)
      useBoardStore.getState().goToVariationMove(0)
      useBoardStore.getState().makeMove('e4', 'd5', undefined) // 2.exd5 (이어서 둔 수)
    })

    it('이어 둔 수에 메모를 저장하면 변형선도 갱신된다', async () => {
      const onPersist = vi.fn()
      renderPanel({ onPersist })

      expect(screen.getByText('메모를 저장하면 변형선도 함께 저장됩니다')).toBeInTheDocument()
      await userEvent.click(screen.getByText('메모 추가...'))
      await userEvent.type(screen.getByRole('textbox'), '폰을 잡는다')
      await userEvent.click(screen.getByText('저장'))

      const saved = useBoardStore.getState().savedVariations
      expect(saved).toHaveLength(1)
      expect(saved[0].moves).toEqual(['d5', 'exd5'])
      expect(saved[0].moveComments).toEqual({ '1': '폰을 잡는다' })
      expect(onPersist).toHaveBeenCalledTimes(1)
    })
  })

  describe('저장 전 변형선', () => {
    beforeEach(() => {
      useBoardStore.getState().goToMove(0)
      useBoardStore.getState().makeMove('d7', 'd5', undefined) // variation 시작
    })

    it('메모 입력을 표시하고, 저장하면 변형선도 함께 저장된다는 안내를 보여준다', () => {
      renderPanel()

      expect(screen.getByText('새 변형선 · 1...d5')).toBeInTheDocument()
      expect(screen.getByText('메모를 저장하면 변형선도 함께 저장됩니다')).toBeInTheDocument()
    })

    it('메모를 저장하면 변형선이 저장되고 그 변형선의 메모로 들어간다', async () => {
      const onPersist = vi.fn()
      renderPanel({ onPersist })

      await userEvent.click(screen.getByText('메모 추가...'))
      await userEvent.type(screen.getByRole('textbox'), '스칸디나비안')
      await userEvent.click(screen.getByText('저장'))

      const state = useBoardStore.getState()
      expect(state.savedVariations).toHaveLength(1)
      expect(state.savedVariations[0].moves).toEqual(['d5'])
      expect(state.savedVariations[0].moveComments).toEqual({ '0': '스칸디나비안' })
      expect(state.activeVariationIndex).toBe(0)
      expect(onPersist).toHaveBeenCalledTimes(1)
      expect(screen.getByText('스칸디나비안')).toBeInTheDocument()
    })

    it('빈 메모를 저장하면 변형선을 저장하지 않는다', async () => {
      const onPersist = vi.fn()
      renderPanel({ onPersist })

      await userEvent.click(screen.getByText('메모 추가...'))
      await userEvent.click(screen.getByText('저장'))

      expect(useBoardStore.getState().savedVariations).toHaveLength(0)
      expect(onPersist).not.toHaveBeenCalled()
    })
  })

  it('저장 클릭 시 onPersist 콜백을 호출한다', async () => {
    useBoardStore.getState().goToMove(0)
    const onPersist = vi.fn()
    renderPanel({ onPersist })

    await userEvent.click(screen.getByText('메모 추가...'))
    await userEvent.type(screen.getByRole('textbox'), '좋은 수')
    await userEvent.click(screen.getByText('저장'))

    expect(onPersist).toHaveBeenCalledTimes(1)
    expect(useBoardStore.getState().moveComments['0']).toBe('좋은 수')
  })

  it('isPersisting=true일 때 저장 버튼이 비활성화되고 라벨이 바뀐다', async () => {
    useBoardStore.getState().goToMove(0)
    renderPanel({ isPersisting: true })

    await userEvent.click(screen.getByText('메모 추가...'))

    const saveBtn = screen.getByRole('button', { name: '저장 중...' })
    expect(saveBtn).toBeDisabled()
  })

  it('textarea에 올바른 aria-label을 설정한다', async () => {
    useBoardStore.getState().goToMove(0)
    renderPanel()

    await userEvent.click(screen.getByText('메모 추가...'))

    expect(screen.getByLabelText('1. e4 메모')).toBeInTheDocument()
  })
})
