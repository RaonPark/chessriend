import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { PgnImportForm } from '../PgnImportForm'

describe('PgnImportForm', () => {
  it('PGN 입력란을 렌더링한다', () => {
    renderWithProviders(<PgnImportForm />)
    expect(screen.getByLabelText('PGN 기보')).toBeInTheDocument()
  })

  it('PGN이 비어있으면 가져오기 버튼이 비활성화된다', () => {
    renderWithProviders(<PgnImportForm />)
    expect(screen.getByText('게임 가져오기')).toBeDisabled()
  })

  it('PGN을 입력하면 가져오기 버튼이 활성화된다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<PgnImportForm />)

    await user.type(screen.getByLabelText('PGN 기보'), '1. e4 e5 1-0')

    expect(screen.getByText('게임 가져오기')).not.toBeDisabled()
  })
})
