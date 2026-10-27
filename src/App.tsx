import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import ActivityDialog from './components/ActivityDialog'
import Toast, { type ToastMessage, type Tone } from './components/Toast'
import Toolbar from './components/Toolbar'
import WeekGrid from './components/WeekGrid'
import { downloadCalendar, downloadRoutine, readRoutineFile, routineFilename } from './lib/io'
import { intersectsWindow } from './lib/layout'
import { isTextEntry, shortcut } from './lib/platform'
import { visibleRange } from './lib/range'
import { createId, defaultRoutine, sampleRoutine } from './lib/schema'
import { MINUTES_IN_DAY, clampMinutes, floorToSlot, nowMinutes } from './lib/time'
import {
  ALL_DAYS,
  type Activity,
  type DayIndex,
  type Routine,
  type RoutineSettings,
} from './types'

const UNDO_LIMIT = 50

interface State {
  present: Routine
  past: Routine[]
  /** True when the on-screen routine differs from the last exported file. */
  dirty: boolean
}

type Action =
  | { type: 'setName'; name: string }
  | { type: 'setSettings'; settings: RoutineSettings }
  | { type: 'saveActivity'; activity: Activity; clones: Activity[]; isNew: boolean }
  | { type: 'updateActivity'; activity: Activity }
  | { type: 'deleteActivity'; id: string }
  | { type: 'replace'; routine: Routine; dirty: boolean }
  | { type: 'undo' }
  | { type: 'markSaved' }

function withEdit(state: State, next: Routine): State {
  return {
    present: { ...next, updatedAt: new Date().toISOString() },
    past: [...state.past, state.present].slice(-UNDO_LIMIT),
    dirty: true,
  }
}

function reducer(state: State, action: Action): State {
  const { present } = state
  switch (action.type) {
    case 'setName':
      return withEdit(state, { ...present, name: action.name })

    case 'setSettings':
      return withEdit(state, { ...present, settings: action.settings })

    case 'saveActivity': {
      const activities = action.isNew
        ? [...present.activities, action.activity, ...action.clones]
        : [
            ...present.activities.map((item) =>
              item.id === action.activity.id ? action.activity : item,
            ),
            ...action.clones,
          ]
      return withEdit(state, { ...present, activities })
    }

    case 'updateActivity':
      return withEdit(state, {
        ...present,
        activities: present.activities.map((item) =>
          item.id === action.activity.id ? action.activity : item,
        ),
      })

    case 'deleteActivity':
      return withEdit(state, {
        ...present,
        activities: present.activities.filter((item) => item.id !== action.id),
      })

    case 'replace':
      return {
        present: action.routine,
        past: [...state.past, present].slice(-UNDO_LIMIT),
        dirty: action.dirty,
      }

    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous) return state
      return { present: previous, past: state.past.slice(0, -1), dirty: true }
    }

    case 'markSaved':
      return { ...state, dirty: false }
  }
}

interface Editor {
  mode: 'create' | 'edit'
  activity: Activity
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, null, () => ({
    present: defaultRoutine(),
    past: [],
    dirty: false,
  }))
  const routine = state.present
  const { settings } = routine

  const [editor, setEditor] = useState<Editor | null>(null)
  const [message, setMessage] = useState<ToastMessage | null>(null)

  /** Raise a transient toast. The id makes a repeated message restart its timer. */
  const notify = useCallback((tone: Tone, text: string) => {
    setMessage({ id: Date.now() + Math.random(), tone, text })
  }, [])
  const dismiss = useCallback(() => setMessage(null), [])

  /** The hour window actually drawn — follows the activities unless pinned. */
  const range = useMemo(
    () => visibleRange(routine.activities, settings),
    [routine.activities, settings],
  )

  const handleExport = useCallback(() => {
    downloadRoutine(routine)
    dispatch({ type: 'markSaved' })
    notify('info', `Downloaded ${routineFilename(routine)}`)
  }, [routine, notify])

  const handleShareCalendar = useCallback(() => {
    const file = downloadCalendar(routine)
    notify('info', `${file} downloaded — open it to add the events to your calendar`)
  }, [routine, notify])

  const handleImportFile = useCallback(
    async (file: File) => {
      if (
        state.dirty &&
        !window.confirm('Importing replaces what is on screen, and your unsaved changes will be lost. Continue?')
      ) {
        return
      }
      const result = await readRoutineFile(file)
      if (!result.ok) {
        notify('error', result.error)
        return
      }
      // Freshly imported matches a file on disk, so it starts clean.
      dispatch({ type: 'replace', routine: result.routine, dirty: false })
      if (result.warnings.length > 0) {
        notify('warn', `Loaded with warnings — ${result.warnings.join(' ')}`)
      } else {
        notify('info', `Loaded "${result.routine.name}".`)
      }
    },
    [state.dirty, notify],
  )

  // ⌘Z / Ctrl+Z undoes; ⌘S / Ctrl+S exports, which stops the browser offering
  // to save the page.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        // Inside a text field the browser's own undo should win, or typing in
        // the routine name and hitting undo would discard the whole routine.
        if (isTextEntry(event.target)) return
        event.preventDefault()
        dispatch({ type: 'undo' })
      } else if (key === 's') {
        event.preventDefault()
        handleExport()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleExport])

  // Nothing is persisted, so leaving with unsaved edits loses them.
  useEffect(() => {
    if (!state.dirty) return
    const handler = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [state.dirty])

  const handleAdd = useCallback(() => {
    const todayIndex = new Date().getDay() as DayIndex
    const day = settings.visibleDays.includes(todayIndex)
      ? todayIndex
      : (ALL_DAYS.find((value) => settings.visibleDays.includes(value)) ?? 0)
    const start = clampMinutes(
      floorToSlot(Math.max(range.dayStart, nowMinutes()), settings.slotMinutes),
      range.dayStart,
      Math.max(range.dayStart, range.dayEnd - settings.slotMinutes),
    )
    setEditor({
      mode: 'create',
      activity: {
        id: createId(),
        title: '',
        day,
        start,
        end: Math.min(start + 60, MINUTES_IN_DAY),
        color: 'blue',
      },
    })
  }, [settings, range])

  const handleSaveActivity = useCallback(
    (activity: Activity, copyToDays: DayIndex[]) => {
      const clones = copyToDays.map((day) => ({ ...activity, id: createId(), day }))
      dispatch({
        type: 'saveActivity',
        activity,
        clones,
        isNew: editor?.mode === 'create',
      })
      setEditor(null)
    },
    [editor],
  )

  const handleDeleteActivity = useCallback((id: string) => {
    dispatch({ type: 'deleteActivity', id })
    setEditor(null)
  }, [])

  const handleClear = useCallback(() => {
    if (!window.confirm('Remove every activity from this routine?')) return
    dispatch({
      type: 'replace',
      routine: { ...defaultRoutine(), name: routine.name, settings: routine.settings },
      dirty: true,
    })
    // There is no Undo button any more, so name the shortcut when it matters.
    notify('info', `Cleared — press ${shortcut('Z')} to undo`)
  }, [routine.name, routine.settings, notify])

  const handleLoadSample = useCallback(() => {
    dispatch({ type: 'replace', routine: sampleRoutine(), dirty: true })
    notify('info', 'Loaded a sample week — edit or clear it as you like.')
  }, [notify])

  /** Activities the current day/hour window is hiding from view. */
  const hiddenCount = useMemo(
    () =>
      routine.activities.filter(
        (activity) =>
          !settings.visibleDays.includes(activity.day) ||
          !intersectsWindow(activity, range.dayStart, range.dayEnd),
      ).length,
    [routine.activities, settings, range],
  )

  return (
    <div className="app-shell mx-auto flex h-full max-w-[1500px] flex-col gap-3 p-4 md:p-7">
      <div className="print-only">
        <h1 className="text-lg font-bold">{routine.name}</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {routine.activities.length - hiddenCount} of {routine.activities.length} activities shown ·
          printed {new Date().toLocaleDateString()}
        </p>
      </div>

      <Toolbar
        name={routine.name}
        dirty={state.dirty}
        activityCount={routine.activities.length}
        onNameChange={(name) => dispatch({ type: 'setName', name })}
        onAdd={handleAdd}
        onImportFile={handleImportFile}
        settings={settings}
        onSettingsChange={(next) => dispatch({ type: 'setSettings', settings: next })}
        onExport={handleExport}
        onShareCalendar={handleShareCalendar}
        onPrint={() => window.print()}
        onClear={handleClear}
      />

      {message ? <Toast message={message} onDismiss={dismiss} /> : null}

      {hiddenCount > 0 ? (
        <div className="msg no-print" data-tone="warn" role="status">
          <span className="flex-1">
            {hiddenCount} {hiddenCount === 1 ? 'activity is' : 'activities are'} on{' '}
            {settings.autoFitHours ? 'a day that is' : 'a day or at an hour that is'} not currently
            shown. Adjust it under “Hours &amp; days” to see {hiddenCount === 1 ? 'it' : 'them'}.
          </span>
        </div>
      ) : null}

      {routine.activities.length === 0 ? (
        <div className="msg no-print" data-tone="info">
          <span className="flex-1">
            Drag anywhere on the grid to block out your first activity, or use{' '}
            <strong>+ Activity</strong>. Nothing is stored in your browser — use{' '}
            <strong>Export</strong> to keep a routine.
          </span>
          <button type="button" className="btn" onClick={handleLoadSample}>Load sample week</button>
        </div>
      ) : null}

      <main className="min-h-0 flex-1">
        <WeekGrid
          routine={routine}
          range={range}
          onRequestCreate={(draft) => setEditor({ mode: 'create', activity: draft })}
          onRequestEdit={(activity) => setEditor({ mode: 'edit', activity })}
          onChangeActivity={(activity) => dispatch({ type: 'updateActivity', activity })}
          onDeleteActivity={handleDeleteActivity}
        />
      </main>

      {editor ? (
        <ActivityDialog
          key={editor.activity.id}
          mode={editor.mode}
          activity={editor.activity}
          onSave={handleSaveActivity}
          onDelete={handleDeleteActivity}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </div>
  )
}
