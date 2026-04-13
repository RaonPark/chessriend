import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { ImportPage } from '../ImportPage'

describe('ImportPage', () => {
  it('플랫폼 선택 카드를 렌더링한다', () => {
    renderWithProviders(<ImportPage />)

    expect(screen.getByText('Lichess')).toBeInTheDocument()
    expect(screen.getByText('Chess.com')).toBeInTheDocument()
  })

  it('닉네임 입력 필드를 렌더링한다', () => {
    renderWithProviders(<ImportPage />)

    expect(screen.getByPlaceholderText('lichess.org 닉네임')).toBeInTheDocument()
  })

  it('닉네임이 비어있으면 가져오기 버튼이 비활성화된다', () => {
    renderWithProviders(<ImportPage />)

    expect(screen.getByText('가져오기 시작')).toBeDisabled()
  })

  it('닉네임을 입력하면 가져오기 버튼이 활성화된다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ImportPage />)

    await user.type(screen.getByPlaceholderText('lichess.org 닉네임'), 'testuser')

    expect(screen.getByText('가져오기 시작')).not.toBeDisabled()
  })

  it('Chess.com 선택 시 placeholder가 변경된다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ImportPage />)

    await user.click(screen.getByText('Chess.com'))

    expect(screen.getByPlaceholderText('chess.com 닉네임')).toBeInTheDocument()
  })

  it('경기 수 선택 버튼을 렌더링한다', () => {
    renderWithProviders(<ImportPage />)

    expect(screen.getByText('최근 10경기')).toBeInTheDocument()
    expect(screen.getByText('최근 50경기')).toBeInTheDocument()
    expect(screen.getByText('최근 100경기')).toBeInTheDocument()
    expect(screen.getByText('최근 200경기')).toBeInTheDocument()
  })

  it('기간 지정 토글을 클릭하면 날짜 필터를 표시한다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ImportPage />)

    await user.click(screen.getByText('기간 지정 (선택사항)'))

    expect(screen.getByText('시작')).toBeInTheDocument()
    expect(screen.getByText('종료')).toBeInTheDocument()
  })

  it('게임 목록 링크를 표시한다', () => {
    renderWithProviders(<ImportPage />)
    expect(screen.getByText(/게임 목록/)).toBeInTheDocument()
  })
})
