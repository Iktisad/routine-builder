import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface Props {
  label: ReactNode
  /** Rendered with `close` so an item can dismiss the menu after acting. */
  children: (close: () => void) => ReactNode
  title?: string
  /** Names the trigger when its label is visually hidden on phones. */
  ariaLabel?: string
  disabled?: boolean
  /** Wider popovers (the Hours panel) need more room than a short item list. */
  width?: number
}

/**
 * A popover anchored under a pill button.
 *
 * Deliberately overlays the page rather than taking part in layout — the
 * settings panel used to render inline and shoved the whole calendar down.
 */
export default function Menu({ label, children, title, ariaLabel, disabled, width = 15 }: Props) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  return (
    <div className="menu-anchor" ref={anchorRef}>
      <button
        ref={triggerRef}
        type="button"
        className="pill-btn"
        title={title}
        aria-label={ariaLabel}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <span className="menu-caret" aria-hidden="true" />
      </button>

      {open ? (
        <div
          id={menuId}
          className="menu-popover"
          role="menu"
          style={{ width: `${width}rem` }}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  )
}
