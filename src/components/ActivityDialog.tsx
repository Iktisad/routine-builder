import { useEffect, useRef, useState } from 'react'
import { COLOR_LABELS, swatchStyle } from '../lib/palette'
import { formatDuration, fromTimeInput, toTimeInput } from '../lib/time'
import {
  ALL_DAYS,
  COLOR_KEYS,
  DAY_NAMES,
  DAY_SHORT,
  type Activity,
  type ColorKey,
  type DayIndex,
} from '../types'

interface Props {
  mode: 'create' | 'edit'
  activity: Activity
  onSave: (activity: Activity, copyToDays: DayIndex[]) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function ActivityDialog({ mode, activity, onSave, onDelete, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [title, setTitle] = useState(activity.title)
  const [day, setDay] = useState<DayIndex>(activity.day)
  const [startText, setStartText] = useState(toTimeInput(activity.start))
  const [endText, setEndText] = useState(toTimeInput(activity.end))
  const [color, setColor] = useState<ColorKey>(activity.color)
  const [location, setLocation] = useState(activity.location ?? '')
  const [note, setNote] = useState(activity.note ?? '')
  const [copyToDays, setCopyToDays] = useState<DayIndex[]>([])
  const [error, setError] = useState<string | null>(null)

  // Mounted only while open, so showModal belongs in a mount effect.
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const start = fromTimeInput(startText)
  const end = fromTimeInput(endText)
  const duration = start !== null && end !== null && end > start ? formatDuration(end - start) : null

  const handleSubmit = () => {
    if (!title.trim()) return setError('Give the activity a name.')
    if (start === null || end === null) return setError('Enter both a start and an end time.')
    if (end <= start) return setError('The end time has to be after the start time.')

    onSave(
      {
        ...activity,
        title: title.trim(),
        day,
        start,
        end,
        color,
        location: location.trim() || undefined,
        note: note.trim() || undefined,
      },
      copyToDays.filter((target) => target !== day),
    )
  }

  const toggleCopyDay = (target: DayIndex) => {
    setCopyToDays((current) =>
      current.includes(target) ? current.filter((d) => d !== target) : [...current, target],
    )
  }

  return (
    <dialog
      ref={dialogRef}
      className="sheet no-print"
      aria-label={mode === 'create' ? 'Add activity' : 'Edit activity'}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <form
        className="flex flex-col gap-3 p-4"
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit()
        }}
      >
        <h2 className="sheet-title">
          {mode === 'create' ? 'Add activity' : 'Edit activity'}
        </h2>

        <div>
          <label className="label" htmlFor="activity-title">Activity</label>
          <input
            id="activity-title"
            className="field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Deep work, Gym, Arabic class"
            autoFocus
          />
        </div>

        <div className="dialog-times grid grid-cols-3 gap-2">
          <div>
            <label className="label" htmlFor="activity-day">Day</label>
            <select
              id="activity-day"
              className="field"
              value={day}
              onChange={(event) => setDay(Number(event.target.value) as DayIndex)}
            >
              {ALL_DAYS.map((value) => (
                <option key={value} value={value}>{DAY_NAMES[value]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="activity-start">Start</label>
            <input
              id="activity-start"
              className="field"
              type="time"
              value={startText}
              onChange={(event) => setStartText(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="activity-end">End</label>
            <input
              id="activity-end"
              className="field"
              type="time"
              value={endText}
              onChange={(event) => setEndText(event.target.value)}
            />
          </div>
        </div>

        <div>
          <span className="label">Colour{duration ? ` · ${duration}` : ''}</span>
          <div className="flex flex-wrap gap-1.5">
            {COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className="swatch"
                style={swatchStyle(key)}
                aria-pressed={color === key}
                aria-label={COLOR_LABELS[key]}
                title={COLOR_LABELS[key]}
                onClick={() => setColor(key)}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="activity-location">Place (optional)</label>
            <input
              id="activity-location"
              className="field"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="activity-note">Note (optional)</label>
            <input
              id="activity-note"
              className="field"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>

        <div>
          <span className="label">
            {mode === 'create' ? 'Also add on' : 'Copy to'} (optional)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ALL_DAYS.map((value) => (
              <button
                key={value}
                type="button"
                className="chip"
                disabled={value === day}
                aria-pressed={copyToDays.includes(value) && value !== day}
                onClick={() => toggleCopyDay(value)}
                title={value === day ? `${DAY_NAMES[value]} is this activity's own day` : DAY_NAMES[value]}
              >
                {DAY_SHORT[value]}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p className="text-xs font-semibold" style={{ color: 'var(--danger)' }} role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-1 flex items-center justify-between gap-2">
          {mode === 'edit' ? (
            <button type="button" className="btn btn-danger" onClick={() => onDelete(activity.id)}>
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              {mode === 'create' ? 'Add' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
