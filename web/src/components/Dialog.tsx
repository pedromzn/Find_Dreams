/** A modal dialog on the native `<dialog>` (focus trap, Esc to close and the backdrop come with it). */

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from '@phosphor-icons/react'
import { useT } from '@/i18n'

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const t = useT()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="card m-auto w-[min(640px,calc(100vw-2rem))] rounded-panel p-0 text-text backdrop:bg-black/70"
    >
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-xl">{title}</h2>
        <button type="button" onClick={onClose} className="text-muted hover:text-text" aria-label={t.general.close}>
          <X size={18} />
        </button>
      </div>
      <div className="flex flex-col gap-4 p-6">{children}</div>
    </dialog>
  )
}
