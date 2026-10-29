import { useRef } from 'react'
import { addMonthsIso, isUntilInPast } from '../lib/ics'
import { shortcut } from '../lib/platform'
import type { RoutineSettings } from '../types'
import Menu from './Menu'
import SettingsPanel from './SettingsPanel'
import {
  IconCalendar,
  IconClock,
  IconExport,
  IconImport,
  IconPlus,
  IconPrint,
  IconShare,
  IconTrash,
} from './icons'

interface Props {
  name: string
  dirty: boolean
  activityCount: number
  settings: RoutineSettings
  onNameChange: (name: string) => void
  onSettingsChange: (settings: RoutineSettings) => void
  onAdd: () => void
  onImportFile: (file: File) => void
  onExport: () => void
  onShareCalendar: () => void
  onPrint: () => void
  onClear: () => void
}

const HORIZONS = [
  { months: 3, label: '3 months' },
  { months: 6, label: '6 months' },
  { months: 12, label: '1 year' },
]

export default function Toolbar({
  name,
  dirty,
  activityCount,
  settings,
  onNameChange,
  onSettingsChange,
  onAdd,
  onImportFile,
  onExport,
  onShareCalendar,
  onPrint,
  onClear,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const expired = isUntilInPast(settings.calendarUntil)

  return (
    <div className="toolbar-bar no-print">
      <input
        className="field routine-name"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        aria-label="Routine name"
        placeholder="Routine name"
      />

      <span className="save-state" data-dirty={dirty}>
        {dirty ? 'Unsaved' : 'Saved'}
      </span>

      <div className="btn-pill" role="group" aria-label="Routine actions">
        <button type="button" className="pill-btn pill-accent" onClick={onAdd} aria-label="Add activity">
          <IconPlus /> <span className="pill-label">Activity</span>
        </button>

        <Menu label={<><IconShare /> <span className="pill-label">Share</span></>} ariaLabel="Share" width={19}>
          {(close) => (
            <>
              <div className="menu-section">
                <div className="menu-heading">Add to calendar</div>
                <p className="menu-note">
                  Each activity becomes a weekly repeating event in your default calendar.
                  Re-share after an edit and the events update in place; activities you
                  delete have to be removed in the calendar itself.
                </p>

                <span className="label">Repeats until</span>
                <div className="menu-chips">
                  {HORIZONS.map((horizon) => {
                    const value = addMonthsIso(horizon.months)
                    return (
                      <button
                        key={horizon.months}
                        type="button"
                        className="chip"
                        aria-pressed={settings.calendarUntil === value}
                        onClick={() => onSettingsChange({ ...settings, calendarUntil: value })}
                      >
                        {horizon.label}
                      </button>
                    )
                  })}
                </div>
                <input
                  className="field"
                  type="date"
                  aria-label="Repeats until"
                  value={settings.calendarUntil}
                  onChange={(event) =>
                    event.target.value && onSettingsChange({ ...settings, calendarUntil: event.target.value })
                  }
                />
                {expired ? (
                  <p className="menu-warn" role="alert">
                    That date has passed, so the file would contain no events. Pick a later one.
                  </p>
                ) : null}

                <button
                  type="button"
                  className="menu-item menu-item-primary"
                  role="menuitem"
                  disabled={activityCount === 0 || expired}
                  onClick={() => { onShareCalendar(); close() }}
                >
                  <IconCalendar /> Download .ics
                </button>
              </div>

              <div className="menu-section">
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  disabled={activityCount === 0}
                  onClick={() => { onExport(); close() }}
                >
                  <IconExport /> Save as JSON
                  <span className="menu-shortcut">{shortcut('S')}</span>
                </button>
              </div>
            </>
          )}
        </Menu>

        <button type="button" className="pill-btn" onClick={() => fileRef.current?.click()} aria-label="Import a routine">
          <IconImport /> <span className="pill-label">Import</span>
        </button>

        <button
          type="button"
          className="pill-btn"
          onClick={onPrint}
          aria-label="Print"
          title={`Print or save as PDF (${shortcut('P')})`}
        >
          <IconPrint /> <span className="pill-label">Print</span>
        </button>

        <Menu label={<><IconClock /> <span className="pill-label">Hours</span></>} ariaLabel="Hours and days" width={17}>
          {() => <SettingsPanel settings={settings} onChange={onSettingsChange} />}
        </Menu>

        <button
          type="button"
          className="pill-btn pill-danger"
          onClick={onClear}
          aria-label="Clear all activities"
          disabled={activityCount === 0}
          title="Remove every activity"
        >
          <IconTrash /> <span className="pill-label">Clear</span>
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Reset so re-picking the same file still fires a change event.
          event.target.value = ''
          if (file) onImportFile(file)
        }}
      />
    </div>
  )
}
