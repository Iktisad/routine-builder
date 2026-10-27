import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import { buildAxis, projectMinute, unprojectFraction } from '../lib/axis'
import { layoutDay } from '../lib/layout'
import { createId } from '../lib/schema'
import { MINUTES_IN_DAY, clampMinutes, floorToSlot, nowMinutes, snapMinutes } from '../lib/time'
import type { VisibleRange } from '../lib/range'
import { ALL_DAYS, DAY_NAMES, DAY_SHORT, type Activity, type DayIndex, type Routine } from '../types'
import type { DragMode } from './ActivityBlock'
import DayColumn from './DayColumn'
import TimeGutter from './TimeGutter'

interface Props {
  routine: Routine
  /** The hour window to draw, computed from the activities (or set by hand). */
  range: VisibleRange
  /** A dragged-out time range, ready to be named in the editor. */
  onRequestCreate: (draft: Activity) => void
  onRequestEdit: (activity: Activity) => void
  onChangeActivity: (activity: Activity) => void
  onDeleteActivity: (id: string) => void
}

interface Drag {
  kind: 'create' | DragMode
  activityId: string | null
  originY: number
  anchorMinute: number
  origDay: DayIndex
  origStart: number
  origEnd: number
  day: DayIndex
  start: number
  end: number
  /** Distinguishes a click (open the editor) from a real drag (commit a move). */
  moved: boolean
}

interface Preview {
  kind: Drag['kind']
  activityId: string | null
  day: DayIndex
  start: number
  end: number
}

/** Vertical scale bounds. Below the minimum a 30-minute card stops being legible. */
const MIN_HOUR_PX = 26
const MAX_HOUR_PX = 56
const DEFAULT_HOUR_PX = 56

/** The drag-out range, snapped, and never shorter than one slot. */
function rangeFromDrag(anchor: number, current: number, slot: number) {
  const snapped = snapMinutes(current, slot)
  let start = Math.min(anchor, snapped)
  let end = Math.max(anchor, snapped)
  if (end - start < slot) end = start + slot
  if (end > MINUTES_IN_DAY) {
    end = MINUTES_IN_DAY
    start = Math.min(start, end - slot)
  }
  if (start < 0) {
    start = 0
    end = Math.max(end, slot)
  }
  return { start, end }
}

export default function WeekGrid({
  routine,
  range,
  onRequestCreate,
  onRequestEdit,
  onChangeActivity,
  onDeleteActivity,
}: Props) {
  const { activities, settings } = routine
  const { slotMinutes, visibleDays } = settings
  const { dayStart, dayEnd, bare } = range

  const days = useMemo(
    () => ALL_DAYS.filter((day) => visibleDays.includes(day)),
    [visibleDays],
  )

  // Shared by every column, so a gap only collapses where nothing is scheduled
  // on any visible day — otherwise the columns would stop lining up.
  const axis = useMemo(() => buildAxis(activities, range, days), [activities, range, days])

  const columnRefs = useRef(new Map<DayIndex, HTMLDivElement>())
  const dragRef = useRef<Drag | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [dragging, setDragging] = useState(false)

  const [now, setNow] = useState(() => nowMinutes())
  const today = new Date().getDay() as DayIndex
  useEffect(() => {
    const id = window.setInterval(() => setNow(nowMinutes()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  // Scale an hour so the whole routine fits the space available, rather than
  // pinning it to a fixed height and making the user scroll. The parent's
  // height comes from flex and does not depend on the grid's content, so
  // measuring it cannot feed back into itself.
  const scrollRef = useRef<HTMLDivElement>(null)
  const cornerRef = useRef<HTMLDivElement>(null)
  const [availableHeight, setAvailableHeight] = useState(0)
  const [headerHeight, setHeaderHeight] = useState(0)
  /** Borders plus any horizontal scrollbar — vertical space the grid cannot use. */
  const [chromeHeight, setChromeHeight] = useState(2)

  const measure = useCallback(() => {
    const host = scrollRef.current?.parentElement
    if (!host) return
    setAvailableHeight((prev) => (Math.abs(prev - host.clientHeight) > 1 ? host.clientHeight : prev))
    const head = cornerRef.current?.getBoundingClientRect().height ?? 0
    setHeaderHeight((prev) => (Math.abs(prev - head) > 1 ? head : prev))
    // Borders plus a horizontal scrollbar, if one is showing — real height the
    // columns cannot use. Every setter guards on a >1px change, so the
    // measure → rescale → measure chain settles instead of oscillating.
    const el = scrollRef.current
    const chrome = el ? el.offsetHeight - el.clientHeight : 2
    setChromeHeight((prev) => (Math.abs(prev - chrome) > 1 ? chrome : prev))
  }, [])

  useEffect(() => {
    const host = scrollRef.current?.parentElement
    if (!host) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [measure])

  const fitHourPx = useMemo(() => {
    if (availableHeight <= 0 || axis.totalUnits <= 0) return DEFAULT_HOUR_PX
    const forColumns = availableHeight - headerHeight - chromeHeight
    const ideal = forColumns / axis.totalUnits
    return Math.max(MIN_HOUR_PX, Math.min(MAX_HOUR_PX, ideal))
  }, [availableHeight, headerHeight, chromeHeight, axis.totalUnits])

  // Adding activities changes the grid's height without changing the host's,
  // so the observer never fires. Re-measure after the browser has laid the new
  // content out.
  useEffect(() => {
    const frame = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(frame)
  }, [measure, axis.totalUnits, fitHourPx])

  const registerRef = useCallback((day: DayIndex, element: HTMLDivElement | null) => {
    if (element) columnRefs.current.set(day, element)
    else columnRefs.current.delete(day)
  }, [])

  /**
   * Minutes covered by a vertical pixel delta, starting from `fromMinute`.
   * A flat ratio no longer works: a pixel inside a collapsed band is worth far
   * more time than one inside a normal segment.
   */
  const minutesForDelta = useCallback(
    (fromMinute: number, deltaPx: number) => {
      const first = columnRefs.current.values().next().value
      if (!first) return 0
      const height = first.getBoundingClientRect().height
      if (height <= 0) return 0
      const fraction = projectMinute(axis, fromMinute) + deltaPx / height
      return unprojectFraction(axis, fraction) - fromMinute
    },
    [axis],
  )

  const minuteAt = useCallback(
    (day: DayIndex, clientY: number) => {
      const element = columnRefs.current.get(day)
      if (!element) return dayStart
      const rect = element.getBoundingClientRect()
      if (rect.height <= 0) return dayStart
      // Time is piecewise, so a position maps back through the axis rather than
      // by a flat pixels-per-minute ratio.
      return unprojectFraction(axis, (clientY - rect.top) / rect.height)
    },
    [axis, dayStart],
  )

  const dayAt = useCallback((clientX: number): DayIndex | null => {
    for (const [day, element] of columnRefs.current) {
      const rect = element.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right) return day
    }
    return null
  }, [])

  const handleBackgroundPointerDown = useCallback(
    (day: DayIndex, event: PointerEvent<HTMLDivElement>) => {
      // Blocks sit above the column and bubble their pointerdown up here; only
      // a press on bare column background should start a new activity.
      if (event.button !== 0 || event.target !== event.currentTarget) return
      event.preventDefault()

      const anchor = clampMinutes(
        floorToSlot(minuteAt(day, event.clientY), slotMinutes),
        0,
        MINUTES_IN_DAY - slotMinutes,
      )
      dragRef.current = {
        kind: 'create',
        activityId: null,
        originY: event.clientY,
        anchorMinute: anchor,
        origDay: day,
        origStart: anchor,
        origEnd: anchor + slotMinutes,
        day,
        start: anchor,
        end: anchor + slotMinutes,
        moved: false,
      }
      setPreview({ kind: 'create', activityId: null, day, start: anchor, end: anchor + slotMinutes })
      setDragging(true)
    },
    [minuteAt, slotMinutes],
  )

  const handleBlockPointerDown = useCallback(
    (activity: Activity, mode: DragMode, event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      // preventDefault suppresses the implicit focus, so set it explicitly —
      // arrow-key nudging should work right after a click.
      if (mode === 'move') event.currentTarget.focus()

      dragRef.current = {
        kind: mode,
        activityId: activity.id,
        originY: event.clientY,
        anchorMinute: activity.start,
        origDay: activity.day,
        origStart: activity.start,
        origEnd: activity.end,
        day: activity.day,
        start: activity.start,
        end: activity.end,
        moved: false,
      }
      setPreview({
        kind: mode,
        activityId: activity.id,
        day: activity.day,
        start: activity.start,
        end: activity.end,
      })
      setDragging(true)
    },
    [],
  )

  // Listeners go on `window` rather than using pointer capture: a cross-day
  // move reparents the block's DOM node, which would drop the capture.
  useEffect(() => {
    if (!dragging) return

    const handleMove = (event: globalThis.PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return

      const deltaPx = event.clientY - drag.originY
      if (Math.abs(deltaPx) > 3) drag.moved = true

      let next: { day: DayIndex; start: number; end: number }
      if (drag.kind === 'create') {
        drag.moved = true
        next = { day: drag.origDay, ...rangeFromDrag(drag.anchorMinute, minuteAt(drag.origDay, event.clientY), slotMinutes) }
      } else if (drag.kind === 'resize') {
        const end = clampMinutes(
          drag.origEnd + snapMinutes(minutesForDelta(drag.origEnd, deltaPx), slotMinutes),
          drag.origStart + slotMinutes,
          MINUTES_IN_DAY,
        )
        next = { day: drag.origDay, start: drag.origStart, end }
      } else {
        const duration = drag.origEnd - drag.origStart
        const start = clampMinutes(
          drag.origStart + snapMinutes(minutesForDelta(drag.origStart, deltaPx), slotMinutes),
          0,
          MINUTES_IN_DAY - duration,
        )
        const day = dayAt(event.clientX) ?? drag.origDay
        if (day !== drag.origDay) drag.moved = true
        next = { day, start, end: start + duration }
      }

      if (next.day !== drag.day || next.start !== drag.start || next.end !== drag.end) {
        drag.day = next.day
        drag.start = next.start
        drag.end = next.end
        setPreview({ kind: drag.kind, activityId: drag.activityId, ...next })
      }
    }

    const reset = () => {
      const drag = dragRef.current
      dragRef.current = null
      setPreview(null)
      setDragging(false)
      return drag
    }

    const handleUp = () => {
      const drag = reset()
      if (!drag) return

      if (drag.kind === 'create') {
        onRequestCreate({
          id: createId(),
          title: '',
          day: drag.day,
          start: drag.start,
          end: drag.end,
          color: 'blue',
        })
        return
      }

      const activity = activities.find((item) => item.id === drag.activityId)
      if (!activity) return
      if (!drag.moved) {
        onRequestEdit(activity)
        return
      }
      if (drag.day === activity.day && drag.start === activity.start && drag.end === activity.end) return
      onChangeActivity({ ...activity, day: drag.day, start: drag.start, end: drag.end })
    }

    const handleCancel = () => {
      reset()
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleCancel)
    const previousUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'

    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleCancel)
      document.body.style.userSelect = previousUserSelect
    }
  }, [
    dragging,
    activities,
    slotMinutes,
    minuteAt,
    dayAt,
    minutesForDelta,
    onRequestCreate,
    onRequestEdit,
    onChangeActivity,
  ])

  const handleBlockKeyDown = useCallback(
    (activity: Activity, event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onRequestEdit(activity)
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        onDeleteActivity(activity.id)
        return
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        const step = event.key === 'ArrowUp' ? -slotMinutes : slotMinutes
        if (event.shiftKey) {
          // Shift + vertical arrows resize instead of moving.
          const end = clampMinutes(activity.end + step, activity.start + slotMinutes, MINUTES_IN_DAY)
          if (end !== activity.end) onChangeActivity({ ...activity, end })
        } else {
          const duration = activity.end - activity.start
          const start = clampMinutes(activity.start + step, 0, MINUTES_IN_DAY - duration)
          if (start !== activity.start) onChangeActivity({ ...activity, start, end: start + duration })
        }
        return
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const index = days.indexOf(activity.day)
        if (index === -1) return
        const day = days[index + (event.key === 'ArrowLeft' ? -1 : 1)]
        if (day !== undefined) onChangeActivity({ ...activity, day })
      }
    },
    [days, slotMinutes, onChangeActivity, onDeleteActivity, onRequestEdit],
  )

  /** Activities grouped by day, with the dragged one shown at its live position. */
  const byDay = useMemo(() => {
    const map = new Map<DayIndex, Activity[]>()
    for (const day of ALL_DAYS) map.set(day, [])
    for (const activity of activities) {
      const effective =
        preview && preview.activityId === activity.id
          ? { ...activity, day: preview.day, start: preview.start, end: preview.end }
          : activity
      map.get(effective.day)!.push(effective)
    }
    return map
  }, [activities, preview])

  const gridStyle = {
    '--day-count': days.length,
    '--span-hours': axis.totalUnits,
    '--gutter-w': bare ? '0rem' : '4.25rem',
    // Read through a separate var: an inline --hour-px would outrank the
    // print stylesheet and break page fitting.
    '--fit-hour-px': `${fitHourPx}px`,
    // Shrink the hour scale at print time so the whole window fits one page.
    '--print-hour-px': `${Math.max(14, Math.min(40, 600 / Math.max(axis.totalUnits, 1)))}px`,
  } as CSSProperties

  return (
    <div className="grid-scroll" ref={scrollRef}>
      <div className="week-grid" style={gridStyle}>
        <div className="grid-corner" ref={cornerRef} />
        {days.map((day) => {
          const count = byDay.get(day)!.length
          return (
            <div
              key={`head-${day}`}
              className="day-head"
              data-today={day === today}
              title={DAY_NAMES[day]}
            >
              <div className="day-head-name">{DAY_SHORT[day]}</div>
              <div className="day-head-count">
                {count === 0 ? '—' : `${count} ${count === 1 ? 'item' : 'items'}`}
              </div>
            </div>
          )
        })}

        <TimeGutter axis={axis} bare={bare} />
        {days.map((day) => (
          <DayColumn
            key={`col-${day}`}
            day={day}
            bare={bare}
            axis={axis}
            nowFraction={!bare && day === today && now >= dayStart && now <= dayEnd ? projectMinute(axis, now) : null}
            positioned={layoutDay(byDay.get(day)!, axis)}
            preview={
              preview?.kind === 'create' && preview.day === day
                ? { top: projectMinute(axis, preview.start), height: projectMinute(axis, preview.end) - projectMinute(axis, preview.start) }
                : null
            }
            draggingId={preview?.activityId ?? null}
            registerRef={registerRef}
            onBackgroundPointerDown={handleBackgroundPointerDown}
            onBlockPointerDown={handleBlockPointerDown}
            onBlockKeyDown={handleBlockKeyDown}
          />
        ))}
      </div>
    </div>
  )
}
