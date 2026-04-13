import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useConfirm } from '../useConfirm'

describe('useConfirm', () => {
  it('초기 상태는 닫혀있다', () => {
    const { result } = renderHook(() => useConfirm())

    expect(result.current.dialogProps.open).toBe(false)
    expect(result.current.dialogProps.title).toBe('')
    expect(result.current.dialogProps.message).toBe('')
  })

  it('confirm() 호출 시 다이얼로그가 열린다', () => {
    const { result } = renderHook(() => useConfirm())

    act(() => {
      result.current.confirm({
        title: '삭제 확인',
        message: '정말 삭제하시겠습니까?',
        confirmLabel: '삭제',
        variant: 'danger',
      })
    })

    expect(result.current.dialogProps.open).toBe(true)
    expect(result.current.dialogProps.title).toBe('삭제 확인')
    expect(result.current.dialogProps.message).toBe('정말 삭제하시겠습니까?')
    expect(result.current.dialogProps.confirmLabel).toBe('삭제')
    expect(result.current.dialogProps.variant).toBe('danger')
  })

  it('handleConfirm 호출 시 true를 resolve하고 닫힌다', async () => {
    const { result } = renderHook(() => useConfirm())

    let resolved: boolean | undefined
    act(() => {
      result.current.confirm({ title: 't', message: 'm' }).then((v) => { resolved = v })
    })

    act(() => {
      result.current.dialogProps.onConfirm()
    })

    await waitFor(() => {
      expect(resolved).toBe(true)
    })
    expect(result.current.dialogProps.open).toBe(false)
  })

  it('handleCancel 호출 시 false를 resolve하고 닫힌다', async () => {
    const { result } = renderHook(() => useConfirm())

    let resolved: boolean | undefined
    act(() => {
      result.current.confirm({ title: 't', message: 'm' }).then((v) => { resolved = v })
    })

    act(() => {
      result.current.dialogProps.onCancel()
    })

    await waitFor(() => {
      expect(resolved).toBe(false)
    })
    expect(result.current.dialogProps.open).toBe(false)
  })
})
