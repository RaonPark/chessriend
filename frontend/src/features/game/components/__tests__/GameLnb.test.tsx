import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/test/mocks/server'
import { GameLnb } from '../GameLnb'
import type { LnbSelection } from '../../utils/gameFilters'

const FOLDERS = [
  { id: 'f1', name: '시실리안 연구', gameCount: 12 },
  { id: 'f2', name: '블리츠 패배 복기', gameCount: 7 },
]
const OPENINGS = Array.from({ length: 10 }, (_, i) => ({ name: `Opening ${i + 1}`, count: 20 - i }))

function renderLnb(selection: LnbSelection = { type: 'all' }, selectedGameIds: string[] = []) {
  server.use(
    http.get('/api/folders', () => HttpResponse.json(FOLDERS)),
    http.get('/api/games/openings', () => HttpResponse.json(OPENINGS)),
  )
  const onSelect = vi.fn()
  renderWithProviders(<GameLnb selection={selection} onSelect={onSelect} selectedGameIds={selectedGameIds} />)
  return { onSelect }
}

describe('GameLnb', () => {
  it('모든 게임 / 내 폴더(게임 수) / 오프닝별을 보여주고, 오프닝은 8개까지 보이다가 더보기로 펼친다', async () => {
    renderLnb()
    expect(screen.getByRole('button', { name: '모든 게임' })).toHaveAttribute('aria-current', 'true')
    expect(await screen.findByRole('button', { name: /시실리안 연구\s*12/ })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Opening 8/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Opening 9/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '더보기' }))
    expect(screen.getByRole('button', { name: /Opening 10/ })).toBeInTheDocument()
  })

  it('폴더·오프닝을 누르면 선택을 알린다', async () => {
    const { onSelect } = renderLnb()
    await userEvent.click(await screen.findByRole('button', { name: /블리츠 패배 복기\s*7/ }))
    expect(onSelect).toHaveBeenCalledWith({ type: 'folder', id: 'f2', name: '블리츠 패배 복기' })

    await userEvent.click(screen.getByRole('button', { name: /Opening 1\b/ }))
    expect(onSelect).toHaveBeenCalledWith({ type: 'opening', name: 'Opening 1' })
  })

  it('새 폴더: 이름을 입력해 만들고, 선택한 게임도 함께 넣을 수 있다', async () => {
    renderLnb({ type: 'all' }, ['g1', 'g2'])
    let body: unknown
    server.use(
      http.post('/api/folders', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 'f3', name: '토너먼트', gameCount: 2 }, { status: 201 })
      }),
    )

    await userEvent.click(screen.getByRole('button', { name: '+ 새 폴더' }))
    const dialog = screen.getByRole('dialog', { name: '새 폴더' })
    await userEvent.type(screen.getByLabelText('폴더 이름'), '토너먼트')
    // 시안대로 기본 체크
    expect(screen.getByRole('checkbox', { name: '선택한 게임 2개를 이 폴더에 넣기' })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: '만들기' }))

    await waitFor(() => expect(body).toEqual({ name: '토너먼트', gameIds: ['g1', 'g2'] }))
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
  })

  it('새 폴더: 같은 이름(409)이면 안내하고 창을 닫지 않는다', async () => {
    renderLnb()
    server.use(http.post('/api/folders', () => HttpResponse.json({ message: 'dup' }, { status: 409 })))

    await userEvent.click(screen.getByRole('button', { name: '+ 새 폴더' }))
    await userEvent.type(screen.getByLabelText('폴더 이름'), '시실리안 연구')
    await userEvent.click(screen.getByRole('button', { name: '만들기' }))

    expect(await screen.findByText('같은 이름의 폴더가 이미 있어요.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '새 폴더' })).toBeInTheDocument()
  })

  it('새 폴더: 빈 이름이면 만들기 버튼이 비활성', async () => {
    renderLnb()
    await userEvent.click(screen.getByRole('button', { name: '+ 새 폴더' }))
    await userEvent.type(screen.getByLabelText('폴더 이름'), '   ')
    expect(screen.getByRole('button', { name: '만들기' })).toBeDisabled()
  })

  it('폴더 우클릭 → 이름 변경', async () => {
    renderLnb()
    let body: unknown
    server.use(
      http.patch('/api/folders/f1', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 'f1', name: '시실리안', gameCount: 12 })
      }),
    )

    fireEvent.contextMenu(await screen.findByRole('button', { name: /시실리안 연구\s*12/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: '이름 변경' }))
    const input = screen.getByLabelText('폴더 이름')
    expect(input).toHaveValue('시실리안 연구')
    await userEvent.clear(input)
    await userEvent.type(input, '시실리안')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(body).toEqual({ name: '시실리안' }))
  })

  it('선택 중인 폴더를 삭제하면 확인 후 지우고 "모든 게임"으로 돌아간다', async () => {
    const { onSelect } = renderLnb({ type: 'folder', id: 'f1', name: '시실리안 연구' })
    let deleted = false
    server.use(http.delete('/api/folders/f1', () => { deleted = true; return new HttpResponse(null, { status: 204 }) }))

    await userEvent.click(await screen.findByRole('button', { name: '시실리안 연구 폴더 메뉴' }))
    await userEvent.click(screen.getByRole('menuitem', { name: '폴더 삭제' }))
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(deleted).toBe(true))
    expect(onSelect).toHaveBeenCalledWith({ type: 'all' })
  })
})
