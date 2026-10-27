import { MINUTES_IN_DAY, ceilToHour, floorToHour, fromTimeInput, toTimeInput } from '../lib/time'
import { ALL_DAYS, DAY_NAMES, DAY_SHORT, SLOT_OPTIONS, type DayIndex, type RoutineSettings } from '../types'

interface Props {
  settings: RoutineSettings
  onChange: (settings: RoutineSettings) => void
}

/** Rendered inside the Hours popover, so it stacks vertically. */
export default function SettingsPanel({ settings, onChange }: Props) {
  // Hours snap to whole hours: the gridlines and gutter labels are drawn on a
  // fixed hourly period, so a half-hour window would misalign them.
  const setDayStart = (value: string) => {
    const parsed = fromTimeInput(value)
    if (parsed === null) return
    const dayStart = Math.min(floorToHour(parsed), settings.dayEnd - 60)
    onChange({ ...settings, dayStart: Math.max(0, dayStart) })
  }

  const setDayEnd = (value: string) => {
    const parsed = fromTimeInput(value)
    if (parsed === null) return
    const dayEnd = Math.max(ceilToHour(parsed), settings.dayStart + 60)
    onChange({ ...settings, dayEnd: Math.min(MINUTES_IN_DAY, dayEnd) })
  }

  const toggleDay = (day: DayIndex) => {
    const visible = settings.visibleDays.includes(day)
    // Never let the grid empty out entirely.
    if (visible && settings.visibleDays.length === 1) return
    onChange({
      ...settings,
      visibleDays: visible
        ? settings.visibleDays.filter((d) => d !== day)
        : [...settings.visibleDays, day],
    })
  }

  return (
    <div className="menu-section" aria-label="Grid settings">
      <div>
        <span className="label">Hours shown</span>
        <button
          type="button"
          className="chip"
          aria-pressed={settings.autoFitHours}
          onClick={() => onChange({ ...settings, autoFitHours: !settings.autoFitHours })}
          title="Fit the grid to the hours your activities actually occupy"
        >
          Fit to activities
        </button>
      </div>

      <div className="menu-row">
        <div>
          <label className="label" htmlFor="setting-day-start">Starts</label>
          <input
            id="setting-day-start"
            className="field"
            type="time"
            step={3600}
            disabled={settings.autoFitHours}
            value={toTimeInput(settings.dayStart)}
            onChange={(event) => setDayStart(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="setting-day-end">Ends</label>
          <input
            id="setting-day-end"
            className="field"
            type="time"
            step={3600}
            disabled={settings.autoFitHours}
            value={toTimeInput(settings.dayEnd)}
            onChange={(event) => setDayEnd(event.target.value)}
          />
        </div>
      </div>

      <div>
        <span className="label">Snap to</span>
        <div className="menu-chips">
          {SLOT_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className="chip"
              aria-pressed={settings.slotMinutes === option}
              onClick={() => onChange({ ...settings, slotMinutes: option })}
            >
              {option === 60 ? '1 hr' : `${option} min`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label">Days shown</span>
        <div className="menu-chips">
          {ALL_DAYS.map((day) => (
            <button
              key={day}
              type="button"
              className="chip"
              aria-pressed={settings.visibleDays.includes(day)}
              onClick={() => toggleDay(day)}
              title={DAY_NAMES[day]}
            >
              {DAY_SHORT[day]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
