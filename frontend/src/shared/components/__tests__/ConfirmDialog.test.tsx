import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from '../ConfirmDialog'

describe('ConfirmDialog', () => {
  it('open이 false일 때 아무것도 렌더링하지 않는다', () => {
    const { container } = render(
      <ConfirmDialog open={false} title="제목" message="내용" onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(container.querySelector('dialog')).not.toBeInTheDocument()
  })

  it('open이 true일 때 제목과 메시지를 표시한다', () => {
    render(
      <ConfirmDialog open={true} title="삭제 확인" message="정말 삭제하시겠습니까?" onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(screen.getByText('삭제 확인')).toBeInTheDocument()
    expect(screen.getByText('정말 삭제하시겠습니까?')).toBeInTheDocument()
  })

  it('기본 라벨은 확인/취소이다', () => {
    render(
      <ConfirmDialog open={true} title="t" message="m" onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(screen.getByText('확인')).toBeInTheDocument()
    expect(screen.getByText('취소')).toBeInTheDocument()
  })

  it('커스텀 라벨을 표시한다', () => {
    render(
      <ConfirmDialog open={true} title="t" message="m" confirmLabel="삭제" cancelLabel="돌아가기" onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(screen.getByText('삭제')).toBeInTheDocument()
    expect(screen.getByText('돌아가기')).toBeInTheDocument()
  })

  it('확인 버튼 클릭 시 onConfirm을 호출한다', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog open={true} title="t" message="m" onConfirm={onConfirm} onCancel={() => {}} />,
    )

    await user.click(screen.getByText('확인'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('취소 버튼 클릭 시 onCancel을 호출한다', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog open={true} title="t" message="m" onConfirm={() => {}} onCancel={onCancel} />,
    )

    await user.click(screen.getByText('취소'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('danger variant일 때 확인 버튼에 red 스타일이 적용된다', () => {
    render(
      <ConfirmDialog open={true} title="t" message="m" variant="danger" onConfirm={() => {}} onCancel={() => {}} />,
    )
    const confirmBtn = screen.getByText('확인')
    expect(confirmBtn.className).toContain('bg-red-600')
  })

  it('default variant일 때 확인 버튼에 amber 스타일이 적용된다', () => {
    render(
      <ConfirmDialog open={true} title="t" message="m" variant="default" onConfirm={() => {}} onCancel={() => {}} />,
    )
    const confirmBtn = screen.getByText('확인')
    expect(confirmBtn.className).toContain('bg-amber-700')
  })
})
