import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface ContextMenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
}

interface ContextMenuProps {
  /** 화면 좌표 (보통 contextmenu 이벤트의 clientX / clientY) */
  position: { x: number; y: number }
  items: ContextMenuItem[]
  onClose: () => void
}

const MENU_WIDTH = 176

/** 우클릭 메뉴 (네이티브 브라우저 메뉴 대신). Esc · 바깥 클릭 · 스크롤 시 닫힘, ↑↓로 항목 이동 */
export function ContextMenu({ position, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [])

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    // capture 단계에서 먼저 받아 막음 → 보드 단축키(Esc = 변형선 나가기, 방향키 = 수 이동)가 같이 동작하지 않게
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        const menuItems = [...(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
        const current = menuItems.indexOf(document.activeElement as HTMLButtonElement)
        const next = e.key === 'ArrowDown' ? current + 1 : current - 1
        menuItems[(next + menuItems.length) % menuItems.length]?.focus()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  // 화면 오른쪽/아래로 넘치지 않게
  const left = Math.max(8, Math.min(position.x, window.innerWidth - MENU_WIDTH - 8))
  const top = Math.max(8, Math.min(position.y, window.innerHeight - items.length * 36 - 16))

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ left, top, width: MENU_WIDTH }}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-50 rounded-lg border border-amber-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            item.onSelect()
            onClose()
          }}
          className={`block w-full px-3 py-1.5 text-left text-sm outline-none transition ${
            item.danger
              ? 'text-red-600 hover:bg-red-50 focus:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 dark:focus:bg-red-950/40'
              : 'text-gray-700 hover:bg-amber-50 focus:bg-amber-50 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus:bg-gray-700'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}
