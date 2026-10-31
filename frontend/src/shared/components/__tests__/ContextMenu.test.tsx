import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContextMenu } from '../ContextMenu'

function renderMenu(overrides = {}) {
  const onClose = vi.fn()
  const onDelete = vi.fn()
  render(
    <>
      <p>바깥</p>
      <ContextMenu
        position={{ x: 100, y: 200 }}
        items={[
          { label: '보기', onSelect: vi.fn() },
          { label: '삭제', onSelect: onDelete, danger: true },
        ]}
        onClose={onClose}
        {...overrides}
      />
    </>,
  )
  return { onClose, onDelete }
}

describe('ContextMenu', () => {
  it('지정한 위치에 메뉴 항목을 표시하고 첫 항목에 포커스한다', () => {
    renderMenu()
    const menu = screen.getByRole('menu')
    expect(menu).toHaveStyle({ left: '100px', top: '200px' })
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['보기', '삭제'])
    expect(screen.getByRole('menuitem', { name: '보기' })).toHaveFocus()
  })

  it('항목을 누르면 실행하고 닫힌다', async () => {
    const { onClose, onDelete } = renderMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: '삭제' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalled()
  })

  it('Esc나 바깥 클릭으로 닫힌다', async () => {
    const { onClose } = renderMenu()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByText('바깥'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('구분선과 구역 제목 항목을 표시하고, 방향키 이동에서 건너뛴다', async () => {
    render(
      <ContextMenu
        position={{ x: 0, y: 0 }}
        onClose={() => {}}
        items={[
          { label: '이름 변경', onSelect: () => {} },
          { type: 'separator' },
          { type: 'heading', label: '폴더에 추가' },
          { label: '시실리안', checked: false, onSelect: () => {} },
        ]}
      />,
    )
    expect(screen.getByRole('separator')).toBeInTheDocument()
    expect(screen.getByText('폴더에 추가')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '이름 변경' })).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitemcheckbox', { name: '시실리안' })).toHaveFocus()
  })
})
