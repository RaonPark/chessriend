import { useCallback, useState } from 'react'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { ContextMenu, type ContextMenuItem } from '@/shared/components/ContextMenu'
import { useConfirm } from '@/shared/hooks/useConfirm'
import { useFolders, useOpeningCounts } from '../api/queries'
import { useCreateFolder, useDeleteFolder, useRenameFolder } from '../api/mutations'
import { FolderNameDialog } from './FolderNameDialog'
import type { FolderResponse } from '../types/game'
import type { LnbSelection } from '../utils/gameFilters'

const VISIBLE_OPENINGS = 8

interface GameLnbProps {
  selection: LnbSelection
  onSelect: (selection: LnbSelection) => void
  /** 목록에서 체크한 게임들 — 새 폴더를 만들 때 함께 넣을 수 있음 */
  selectedGameIds: string[]
}

/** 게임 목록 왼쪽 메뉴: 모든 게임 / 내 폴더 / 오프닝별 */
export function GameLnb({ selection, onSelect, selectedGameIds }: GameLnbProps) {
  const { data: folders = [] } = useFolders()
  const { data: openings = [] } = useOpeningCounts()
  const createFolder = useCreateFolder()
  const renameFolder = useRenameFolder()
  const deleteFolder = useDeleteFolder()
  const { confirm, dialogProps } = useConfirm()

  const [showAllOpenings, setShowAllOpenings] = useState(false)
  const [dialog, setDialog] = useState<{ mode: 'create' } | { mode: 'rename'; folder: FolderResponse } | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])

  const visibleOpenings = showAllOpenings ? openings : openings.slice(0, VISIBLE_OPENINGS)

  async function handleDelete(folder: FolderResponse) {
    const ok = await confirm({
      title: '폴더 삭제',
      message: `"${folder.name}" 폴더를 삭제할까요? 폴더 안의 게임은 지워지지 않고 "모든 게임"에 남아요.`,
      confirmLabel: '삭제',
      variant: 'danger',
    })
    if (!ok) return
    await deleteFolder.mutateAsync(folder.id)
    if (selection.type === 'folder' && selection.id === folder.id) onSelect({ type: 'all' })
  }

  function openFolderMenu(folder: FolderResponse, x: number, y: number) {
    setMenu({
      x,
      y,
      items: [
        { label: '이름 변경', onSelect: () => setDialog({ mode: 'rename', folder }) },
        { label: '폴더 삭제', onSelect: () => void handleDelete(folder), danger: true },
      ],
    })
  }

  return (
    <nav aria-label="게임 분류" className="space-y-1 rounded-xl border border-amber-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <LnbItem label="모든 게임" active={selection.type === 'all'} onClick={() => onSelect({ type: 'all' })} />

      <SectionHeader title="내 폴더">
        <button
          type="button"
          aria-label="새 폴더 만들기"
          onClick={() => setDialog({ mode: 'create' })}
          className="rounded-md border border-amber-200 px-1.5 text-xs font-bold leading-5 text-amber-700 hover:bg-amber-50 dark:border-gray-600 dark:text-amber-400 dark:hover:bg-gray-700"
        >
          +
        </button>
      </SectionHeader>
      {folders.map((folder) => (
        <div
          key={folder.id}
          className="group relative"
          onContextMenu={(e) => {
            e.preventDefault()
            openFolderMenu(folder, e.clientX, e.clientY)
          }}
        >
          <LnbItem
            label={folder.name}
            count={folder.gameCount}
            icon="folder"
            active={selection.type === 'folder' && selection.id === folder.id}
            onClick={() => onSelect({ type: 'folder', id: folder.id, name: folder.name })}
          />
          <button
            type="button"
            aria-label={`${folder.name} 폴더 메뉴`}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              openFolderMenu(folder, rect.left, rect.bottom + 4)
            }}
            className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded px-1.5 text-sm font-bold text-amber-700 hover:bg-amber-100 group-focus-within:block group-hover:block dark:text-amber-400 dark:hover:bg-gray-700"
          >
            ⋯
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setDialog({ mode: 'create' })}
        className="w-full rounded-lg border border-dashed border-amber-300 px-2.5 py-1.5 text-left text-xs font-medium text-amber-600 transition hover:bg-amber-50 dark:border-gray-600 dark:text-amber-400 dark:hover:bg-gray-700"
      >
        + 새 폴더
      </button>

      {openings.length > 0 && (
        <>
          <SectionHeader title="오프닝별" />
          {visibleOpenings.map((opening) => (
            <LnbItem
              key={opening.name}
              label={opening.name}
              count={opening.count}
              icon="opening"
              active={selection.type === 'opening' && selection.name === opening.name}
              onClick={() => onSelect({ type: 'opening', name: opening.name })}
            />
          ))}
          {openings.length > VISIBLE_OPENINGS && (
            <button
              type="button"
              onClick={() => setShowAllOpenings((v) => !v)}
              className="px-2.5 py-1 text-xs text-gray-500 hover:text-amber-700 dark:text-gray-400 dark:hover:text-amber-400"
            >
              {showAllOpenings ? '접기' : '더보기'}
            </button>
          )}
        </>
      )}

      {menu && <ContextMenu position={menu} items={menu.items} onClose={closeMenu} />}

      <FolderNameDialog
        open={dialog?.mode === 'create'}
        title="새 폴더"
        confirmLabel="만들기"
        selectedGameCount={selectedGameIds.length}
        isPending={createFolder.isPending}
        onSubmit={(name, includeSelected) =>
          createFolder.mutateAsync({ name, gameIds: includeSelected ? selectedGameIds : [] })
        }
        onClose={() => setDialog(null)}
      />
      <FolderNameDialog
        open={dialog?.mode === 'rename'}
        title="폴더 이름 변경"
        confirmLabel="저장"
        initialName={dialog?.mode === 'rename' ? dialog.folder.name : ''}
        isPending={renameFolder.isPending}
        onSubmit={async (name) => {
          if (dialog?.mode !== 'rename') return
          await renameFolder.mutateAsync({ id: dialog.folder.id, name })
          // 선택 중인 폴더면 제목도 새 이름으로
          if (selection.type === 'folder' && selection.id === dialog.folder.id) {
            onSelect({ type: 'folder', id: dialog.folder.id, name })
          }
        }}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog {...dialogProps} />
    </nav>
  )
}

function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2.5 pb-1 pt-3">
      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-500">{title}</span>
      {children}
    </div>
  )
}

function LnbItem({ label, count, active, icon, onClick }: {
  label: string
  count?: number
  active: boolean
  icon?: 'folder' | 'opening'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-current={active || undefined}
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
        active
          ? 'bg-amber-100 font-semibold text-amber-900 dark:bg-gray-700 dark:text-amber-200'
          : 'text-gray-700 hover:bg-amber-50 dark:text-gray-300 dark:hover:bg-gray-700/60'
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon && (
          <span
            aria-hidden
            className={`inline-block h-2.5 w-3.5 shrink-0 rounded-sm ${icon === 'folder' ? 'bg-amber-500' : 'bg-stone-300 dark:bg-gray-500'}`}
          />
        )}
        <span className="truncate">{label}</span>
      </span>
      {/* 공백 텍스트: 접근성 이름이 "Opening 1 20"처럼 띄어 읽히도록 (붙으면 "Opening 120") */}
      {count != null && ' '}
      {count != null && <span className="shrink-0 text-xs font-normal text-gray-400 group-hover:invisible">{count}</span>}
    </button>
  )
}
