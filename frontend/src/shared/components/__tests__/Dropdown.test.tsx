import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dropdown } from '../Dropdown'

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
]

describe('Dropdown', () => {
  it('선택된 값의 라벨을 표시한다', () => {
    render(<Dropdown value="b" options={options} onChange={() => {}} />)
    expect(screen.getByText('Option B')).toBeInTheDocument()
  })

  it('값이 없으면 placeholder를 표시한다', () => {
    render(<Dropdown value="" options={options} placeholder="선택하세요" onChange={() => {}} />)
    expect(screen.getByText('선택하세요')).toBeInTheDocument()
  })

  it('클릭 시 드롭다운이 열리고 옵션을 표시한다', async () => {
    const user = userEvent.setup()
    render(<Dropdown value="" options={options} onChange={() => {}} />)

    await user.click(screen.getByRole('button'))

    expect(screen.getByText('Option A')).toBeInTheDocument()
    expect(screen.getByText('Option B')).toBeInTheDocument()
    expect(screen.getByText('Option C')).toBeInTheDocument()
  })

  it('옵션 선택 시 onChange를 호출하고 드롭다운이 닫힌다', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Dropdown value="" options={options} onChange={onChange} />)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByText('Option A'))

    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('disabled 상태에서는 클릭해도 열리지 않는다', async () => {
    const user = userEvent.setup()
    render(<Dropdown value="" options={options} disabled onChange={() => {}} />)

    await user.click(screen.getByRole('button'))

    // 옵션들이 렌더링되지 않아야 한다
    expect(screen.queryByText('Option A')).not.toBeInTheDocument()
  })

  it('토글 버튼을 다시 클릭하면 닫힌다', async () => {
    const user = userEvent.setup()
    render(<Dropdown value="" options={options} onChange={() => {}} />)

    const toggle = screen.getByRole('button')
    await user.click(toggle) // 열기
    expect(screen.getByText('Option A')).toBeInTheDocument()

    await user.click(toggle) // 닫기
    // 닫히면 button이 하나 (toggle 자체)만 남아야 함
    expect(screen.queryAllByRole('button')).toHaveLength(1)
  })
})
