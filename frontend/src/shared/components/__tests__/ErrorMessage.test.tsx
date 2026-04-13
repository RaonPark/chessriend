import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorMessage } from '../ErrorMessage'

describe('ErrorMessage', () => {
  it('에러 메시지를 표시한다', () => {
    render(<ErrorMessage message="오류가 발생했습니다." />)
    expect(screen.getByText('오류가 발생했습니다.')).toBeInTheDocument()
  })

  it('onRetry 없으면 재시도 버튼을 표시하지 않는다', () => {
    render(<ErrorMessage message="에러" />)
    expect(screen.queryByText('다시 시도')).not.toBeInTheDocument()
  })

  it('onRetry가 있으면 재시도 버튼을 표시한다', () => {
    render(<ErrorMessage message="에러" onRetry={() => {}} />)
    expect(screen.getByText('다시 시도')).toBeInTheDocument()
  })

  it('재시도 버튼 클릭 시 onRetry를 호출한다', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ErrorMessage message="에러" onRetry={onRetry} />)

    await user.click(screen.getByText('다시 시도'))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
