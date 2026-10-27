import { useEffect } from 'react'
import { IconAlert, IconCheck, IconError } from './icons'

export type Tone = 'info' | 'warn' | 'error'

export interface ToastMessage {
  /** Changes on every notification so repeats restart the timer. */
  id: number
  tone: Tone
  text: string
}

const ICON: Record<Tone, typeof IconCheck> = {
  info: IconCheck,
  warn: IconAlert,
  error: IconError,
}

const LABEL: Record<Tone, string> = {
  info: 'Done',
  warn: 'Heads up',
  error: 'Something went wrong',
}

interface Props {
  message: ToastMessage
  onDismiss: () => void
  /** Milliseconds before it fades out on its own. */
  duration?: number
}

export default function Toast({ message, onDismiss, duration = 5000 }: Props) {
  // Keyed on `id`, so a repeat of the same text restarts the countdown.
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, duration)
    return () => window.clearTimeout(timer)
  }, [message.id, duration, onDismiss])

  const Glyph = ICON[message.tone]

  return (
    <div className="toast-layer no-print">
      <div
        className="toast"
        data-tone={message.tone}
        role={message.tone === 'error' ? 'alert' : 'status'}
        onClick={onDismiss}
        title="Click to dismiss"
      >
        <span className="toast-icon"><Glyph /></span>
        <span className="toast-body">
          <span className="toast-title">{LABEL[message.tone]}</span>
          <span className="toast-text">{message.text}</span>
        </span>
      </div>
    </div>
  )
}
