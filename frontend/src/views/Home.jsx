import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutines, effectiveRoutineIds, nextTrainingDay, lastBW, setsDoneActive } from '../lib/history.js'
import { streakInfo } from '../lib/streak.js'
import { StreakFlame, StreakMeta, StreakParty } from '../components/Streak.jsx'
import { fmtNum, fmtDate, todayISO, isoOf, weekStartOf, weekDayOffset, DAYS, DAYN } from '../lib/format.js'
import { t, tn, dateLocale } from '../lib/i18n.js'
import { bwSheet, goalSheet, dayOverrideSheet, calendarSheet, startFlow, starterPlanSheet, bwDeltaColor, weighInsSheet } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import CardHead from '../components/CardHead.jsx'
import QueueRow from '../components/QueueRow.jsx'
import MiniBodyMap from '../components/MiniBodyMap.jsx'
import { queueOf, queueView, weekTally, pinState } from '../lib/queue.js'
import { workoutsLeft } from '../lib/week-left.js'
import { WeeklySetsHomeLine } from '../components/WeeklySets.jsx'
import { RecapHomeCard } from '../components/Recap.jsx'
import { scheduleModeOf } from '../lib/rotation.js'
import { useConnectionTrouble } from '../components/SyncBanner.jsx'
import { Button } from '../components/ui.jsx'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { glyphOf } from '../lib/glyphs.js'
import { dayNoteOf } from '../lib/day-notes.js'
import { weighInAt } from '../lib/bodyweight.js'
import WeightRate from '../components/WeightRate.jsx'
import { programmeChip } from '../lib/programmes.js'
import { SeasonDeco } from '../components/Seasonal.jsx'
import { WrappedHomeCard } from '../components/WrappedEntry.jsx'
import RecoveryHint from '../components/RecoveryHint.jsx'
import { ChallengesCard } from '../components/Challenges.jsx'
import { isOn, setModule } from '../lib/modules.js'
import { coachAvailable } from '../lib/coach.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import BodyMap from '../components/BodyMap.jsx'
import { Thumb } from '../components/Media.jsx'
import { loadOfRoutine } from '../lib/muscles.js'
import { buildSessionEntries } from '../lib/session-start.js'
import { isWarmupRow } from '../lib/workout-model.js'
import { EXIDX } from '../lib/exercises.js'
import { exerciseNameText } from '../lib/format.js'

// Home = what to do now + a quick glance. Deep charts & history live in Stats.
export default function Home() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  // The banner switched off and the sync stuck: a dot on the gear (Settings → Show connection status).
  const trouble = useConnectionTrouble()
  const [weekOffset, setWeekOffset] = useState(0)
  const [dayOff, setDayOff] = useState(0)   // fork: the day Today shows, 0 is today

  const today = new Date()
  // A weekday can hold several routines. `todayRoutines` is the whole day; `routine` is the
  // first, kept for the one-routine glyph. The derived session name joins them (§9).
  const todayRoutines = effectiveRoutines(S, todayISO())
  const routine = todayRoutines[0] || null
  const todayName = todayRoutines.map(r => r.name).join(' + ')
  // A fulfilled pin (a coach session pinned to today and since done) reads as no override.
  const todayOvr = S.dayPlan[todayISO()] !== undefined && pinState(S, S.dayPlan[todayISO()]) !== 'done'
  // An open editor on a saved workout (lib/session-edit.js) holds S.active too, but it is not a
  // session in progress: the row takes you back to it as an edit, the way the tab bar does.
  const editingSaved = !!S.active?.editingWorkoutId
  const bw = lastBW(S)
  const prevBW = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : null

  const ws = weekStartOf(S)
  // The first day of the shown week. Named for the role, not for Monday — which day that is
  // is the setting.
  const wkStart = new Date(today)
  wkStart.setDate(today.getDate() - weekDayOffset(today.getDay(), ws) + weekOffset * 7)
  const doneDays = new Set(S.workouts.map(w => w.d))
  // The last session logged for today, if any — what the row below reports instead of asking
  // you to start the one you already did. Last wins, so a second session names itself. Only once
  // today's plan is covered, though: a freestyle session on a planned day, or the rotation's
  // first session done when its next one is today's too, leaves the row offering what is still
  // to do, as Start and the progress row already do. A queue session is never "covered" by an
  // earlier workout: the queue only names one it does not count as done yet.
  const loggedToday = S.workouts.filter(w => w.d === todayISO())
  const queueIds = queueOf(S)?.ids || []
  const coveredToday = id => !queueIds.includes(id) && loggedToday.some(w => (Array.isArray(w.routineIds) ? w.routineIds : [w.routineId]).includes(id))
  const doneToday = (todayRoutines.every(r => coveredToday(r.id)) && loggedToday.at(-1)) || null
  const strip = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(wkStart); d.setDate(wkStart.getDate() + i)
    const iso = isoOf(d)
    const eff = effectiveRoutineIds(S, iso).length > 0, ovr = S.dayPlan[iso] !== undefined, done = doneDays.has(iso)
    // A day off with a note (#261) reads as excused, not as a plan that went by.
    const dot = done ? ' done' : dayNoteOf(S, iso) ? ' noted' : ovr && eff ? ' ovr' : eff ? ' plan' : ''
    strip.push(<div key={i} className={'wday' + (iso === todayISO() ? ' today' : '')} {...tappable(() => dayOverrideSheet(iso))}>
      <div className="lbl">{t(DAYS[d.getDay()])}</div><div className="num">{d.getDate()}</div><div className={'dot' + dot} /></div>)
  }
  const wkEnd = new Date(wkStart); wkEnd.setDate(wkStart.getDate() + 6)
  const wkLabel = weekOffset === 0 ? t('This week') : `${wkStart.getDate()} ${wkStart.toLocaleDateString(dateLocale(), { month: 'short' })} – ${wkEnd.getDate()} ${wkEnd.toLocaleDateString(dateLocale(), { month: 'short' })}`

  // A coach week (S.queue) read through the same tolerant reader QueueRow uses, so a malformed
  // queue from another client shows the weekday dots, never an empty card.
  const queue = queueView(S, todayISO())
  // This card shows one thing or the other — QueueRow for a live queue, or Rotation chosen with
  // nothing built yet (S.scheduleMode), in which case there is no queue for QueueRow to render and
  // an empty-state card takes its place. Plan does the same in rotation mode: no weekday grid, only
  // the days that add a routine the loop does not have (Plan.jsx, "Also on fixed days").
  const rotating = scheduleModeOf(S) === 'rotation'
  // A planner-written queue (no rotationId) still names its weekday when it hasn't started yet —
  // that copy predates rotation and stays as it is. Our own rotation has no weekday of its own
  // (lib/rotation.js): naming one here — including on the pass's own one-day empty gap (THE
  // ONE-DAY BOUNDARY, rotation.js) or before a first routine is even added — would be the
  // fixed-week model leaking into a schedule that was never weekday-based.
  const liveQ = queueOf(S)
  const plannerQueue = !!queue && !liveQ?.rotationId
  // Ownership, not mere presence of a rotationId: a stale id left over from a rebuilt rotation
  // would otherwise still read as "this app manages it" (lib/rotation.js).
  const managedQueue = !!liveQ && !!S.rotation && liveQ.rotationId === S.rotation.id
  // On a rest day, saying when you train next beats leaving the row as a full stop.
  const next = !S.active && !todayRoutines.length && !(rotating && !plannerQueue) ? nextTrainingDay(S, todayISO()) : null
  // The streak card's fraction: this calendar week's workouts over the weekdays with a plan, or,
  // in a coach week, the queue's sessions and your own days together (lib/queue.js weekTally).
  const tally = weekTally(S, todayISO())
  const { done: doneThisWeek, planned: plannedPerWeek } = tally
  const left = workoutsLeft(S, todayISO())
  // The streak with its best run and freezes (lib/streak.js), read back from the workouts.
  const todayKey = todayISO()
  const streak = useMemo(() => streakInfo(S, todayKey), [S.workouts, S.weekStart, todayKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // Settings → Modules (lib/modules.js): what a module switched off hides here.
  const on = id => isOn(S, id)
  const bwPoints = S.bodyweight.slice(-30).map(b => ({ t: weighInAt(b), y: b.w, d: b.d }))

  // today's session shown right under the week strip
  const onToday = () => { if (S.active) nav('/workout'); else if (todayRoutines.length) startFlow(effectiveRoutineIds(S, todayISO())); else dayOverrideSheet(todayISO()) }
  // A chip on the coach week's progress row starts that one routine, in any order. A session
  // already in progress wins, as on the today row — starting another would overwrite it.
  const progChip = programmeChip(S)
  const onQueueStart = id => { if (S.active) nav('/workout'); else startFlow([id]) }

  // Fork redesign (Today): a big muscle map of the day's session, the day as a large title with its
  // neighbours either side, a few facts as pills, then one card with the exercises and Start.
  // A swipe (or a tap on a neighbour) moves to the day before or after, to look at what is planned.
  const dayAt = n => { const d = new Date(today); d.setDate(today.getDate() + n); return d }
  const wdName = d => d.toLocaleDateString(dateLocale(), { weekday: 'long' })
  const step = n => setDayOff(o => Math.max(-14, Math.min(28, o + n)))
  const isToday = dayOff === 0, isPast = dayOff < 0
  const viewDate = dayAt(dayOff), viewISO = isoOf(viewDate)
  const dayName = n => (dayOff + n === 0 ? t('Today') : wdName(dayAt(dayOff + n)))
  const vRoutines = isToday ? todayRoutines : effectiveRoutines(S, viewISO)
  const vRoutine = vRoutines[0] || null
  const vName = vRoutines.map(r => r.name).join(' + ')
  const vLogged = isToday ? doneToday : (S.workouts.filter(w => w.d === viewISO).at(-1) || null)
  const vKey = vRoutines.map(r => r.id).join(',')
  const preview = useMemo(() => {
    if ((isToday && S.active) || vLogged) return []
    try {
      return vRoutines.flatMap(r => buildSessionEntries(S, r).map((e, i) => ({ e, id: r.ex[i]?.id, key: r.id + ':' + i })))
    } catch { return [] }
  }, [S, viewISO, vKey, !!vLogged]) // eslint-disable-line react-hooks/exhaustive-deps
  const heroLoad = useMemo(() => loadOfRoutine({ ex: vRoutines.flatMap(r => r?.ex || []) }), [viewISO, vKey, S.routines]) // eslint-disable-line react-hooks/exhaustive-deps
  const workOf = e => (e?.sets || []).filter(x => !isWarmupRow(x))
  const setTotal = preview.reduce((n, p) => n + workOf(p.e).length, 0)
  const lastSame = vRoutine ? [...S.workouts].reverse().find(w => w.d < viewISO && (Array.isArray(w.routineIds) ? w.routineIds : [w.routineId]).includes(vRoutine.id)) : null
  const showMap = vRoutines.some(r => r.ex.length) && !vLogged
  const startLabel = S.active ? (editingSaved ? t('Edit') : t('Resume')) : t('Start workout')
  // Another day's plan can be started now (trained a day early); a day gone by only shows.
  const onStartView = () => { if (S.active) nav('/workout'); else startFlow(effectiveRoutineIds(S, viewISO)) }
  const swipe = useRef(null)
  const onTouchStart = e => { const p = e.touches[0]; swipe.current = { x: p.clientX, y: p.clientY } }
  const onTouchEnd = e => {
    const s0 = swipe.current; swipe.current = null
    const p = e.changedTouches[0]
    if (!s0 || !p) return
    const dx = p.clientX - s0.x, dy = p.clientY - s0.y
    if (Math.abs(dx) < 50 || Math.abs(dx) < 1.5 * Math.abs(dy)) return
    const rtl = document.documentElement.dir === 'rtl'
    step((dx < 0) !== rtl ? 1 : -1)
  }
  // The Coach's button. Off, a tap turns the module on first; with no provider set up yet it
  // lands on the setup screen instead of the chat.
  const coachMode = useStore(s => s.coachLocal?.mode)
  const config = useStore(s => s.config)
  const coachReady = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE, coachMode })
  const openCoach = () => {
    if (!on('coach')) useStore.getState().update(s => setModule(s, 'coach', true))
    nav(coachReady ? '/coach' : '/coach/setup')
  }

  return <div className="narrow today-v">
    <div className="today-top">
      <button className="roundbtn" onClick={() => nav('/plan')} aria-label={t('Plan')} data-tour="tab-plan"><Icon name="calendar" /></button>
      <SeasonDeco spot="header-bats" />
      <div className="row" style={{ gap: 10 }}>
        <button className="roundbtn coachbtn" onClick={openCoach} aria-label={t('Coach')}><Icon name="sparkles" /></button>
        <button className="roundbtn" data-tour="settings-gear" onClick={() => nav('/settings')} aria-label={trouble ? t('Settings') + ', ' + t('Connection problem') : t('Settings')}><Icon name="gear" />{trouble && <span className="tab-dot" aria-hidden="true" />}</button>
      </div>
    </div>

    <div className="today-swipe" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
    {showMap ? <div className="today-map"><BodyMap load={heroLoad} body={S.body} /></div> : <div className="today-map-gap" />}

    <div className="today-days">
      <button className="side l" onClick={() => step(-1)}><span>{dayName(-1)}</span></button>
      <h1>{isToday ? t('Today') : <button className="today-back" onClick={() => setDayOff(0)} aria-label={wdName(viewDate) + ', ' + t('Today')}>{wdName(viewDate)}</button>}</h1>
      <button className="side r" onClick={() => step(1)}><span>{dayName(1)}</span></button>
    </div>
    {!isToday && <div className="small dim today-date">{fmtDate(viewISO, true)}</div>}

    <div className="today-pills">
      {setTotal > 0 && <span className="pill-o">{tn('{0} set', '{0} sets', setTotal)}</span>}
      {preview.length > 0 && <span className="pill-o">{tn('{0} exercise', '{0} exercises', preview.length)}</span>}
      {isToday && !S.active && <button className="pill-f" onClick={() => nav('/workout')} aria-label={t('Choose a different workout')}>
        {routine ? todayName : t('Rest day')}<Icon name="swap" /></button>}
      {!isToday && !isPast && <button className="pill-f" onClick={() => dayOverrideSheet(viewISO)} aria-label={t('Choose a different workout')}>
        {vRoutine ? vName : t('Rest day')}<Icon name="swap" /></button>}
    </div>

    {rotating && isToday && <div className="card">
      {queue ? <QueueRow S={S} today={todayISO()} onStart={onQueueStart} managed={managedQueue} /> : <div className="empty">
        {t('No rotation yet. Add routines to it in Plan.')}
        <div style={{ marginTop: 10 }}><Button size="sm" variant="tinted" onClick={() => nav('/plan')}>{t('Set up in Plan')}</Button></div>
      </div>}
    </div>}

    <div className="card today-card" data-tour="today">
      {isToday && progChip && <button type="button" className="chip ichip prog-chip" onClick={() => nav('/plan/programmes')}><Icon name="calendar" /><span>{progChip}</span></button>}
      <div className="row between today-card-hd">
        <div className="ttl">{isToday ? (S.active ? (editingSaved ? S.active.name : t('{0} (in progress)', S.active.name))
          : doneToday ? (doneToday.name ? t('{0} (done)', doneToday.name) : t('Workout done'))
          : routine ? todayName : t('Rest day')) + (todayOvr && routine && !doneToday ? ' · ' + t('rescheduled') : '')
          : vLogged ? (vLogged.name ? t('{0} (done)', vLogged.name) : t('Workout done'))
          : vRoutine ? vName : t('Rest day')}</div>
        {lastSame && !(isToday && S.active) && !vLogged && <span className="small dim">{t('Last time')}: {fmtDate(lastSame.d, true)}</span>}
      </div>
      {isToday && next && !doneToday && <div className="small dim ss" style={{ marginTop: 4 }}>{t('Next session: {0}, {1}', t(DAYN[next.weekday]), next.routine.name)}</div>}
      {preview.length > 0 && <div className="today-list">
        {preview.map(({ e, id, key }) => {
          const ex = EXIDX[id]
          const w = workOf(e), first = w[0]
          return <div className="today-ex" key={key}>
            {ex ? <Thumb ex={ex} /> : <span className="today-ph" />}
            <span className="nm">{ex ? exerciseNameText(ex) : id}<span className="dim"> · {w.length}×</span></span>
            {first && (first.r > 0 || first.sec > 0) && <span className="tg">{first.sec > 0 ? first.sec + ' s' : (first.w > 0 ? fmtNum(first.w) + ' ' + S.unit + ' × ' : '') + first.r}</span>}
          </div>
        })}
      </div>}
      {isToday && (routine || S.active) && !doneToday && <Button variant="primary" className="today-start" icon="play" onClick={onToday}>{startLabel}</Button>}
      {isToday && !routine && !S.active && !doneToday && <Button className="today-start" icon="plus" onClick={onToday}>{t('Plan')}</Button>}
      {!isToday && !isPast && vRoutine && !vLogged && <Button variant="primary" className="today-start" icon="play" onClick={onStartView}>{S.active ? t('Resume') : t('Start workout')}</Button>}
      <SeasonDeco spot="home-hero" />
    </div>
    </div>

    {!rotating && left && <div className="card today-week" {...tappable(() => nav('/plan'))}>
      <div><div className="small dim">{t('This week')}</div>
        <div className="ttl2 wkleft">{left.left > 0 ? tn('{0} of {1} left this week', '{0} of {1} left this week', left.left, left.of) : t('All done this week. Nice.')}</div></div>
      <div className="week-dots" aria-hidden="true">{Array.from({ length: left.of }, (_, i) => <span key={i} className={i < left.of - left.left ? 'on' : ''} />)}</div>
    </div>}

    {!S.routines.length && !S.active && (
      <div className="card">
        <CardHead icon="calendar" title={t('Welcome!')} sub={t('Set up your weekly routine to get going, or grab a ready-made starter plan.')} />
        <Button variant="primary" icon="clipboard" onClick={starterPlanSheet}>{t('Load starter plan')}</Button>
        <div style={{ height: 8 }} /><Button onClick={() => nav('/plan')}>{t('Build my own plan')}</Button>
      </div>
    )}

    {on('body') && S.showWeightCard !== false && <div className="card today-bw">
      <div className="row between">
        <div {...tappable(() => weighInsSheet())} style={{ minWidth: 0 }}>
          <div className="small dim bw-lbl">{t('Body weight')}</div>
          {bw ? <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
            <span className="ttl2">{fmtNum(bw.w)} <span className="dim small">{S.unit}</span></span>
            {!!delta && <span className="small" style={{ fontWeight: 600, color: bwDeltaColor(delta, bw.w) }}>{delta > 0 ? '+' : '−'}{fmtNum(Math.abs(delta))}</span>}
          </div> : <div className="small muted">{t('No weigh-ins yet. Log your weight to start the curve.')}</div>}
        </div>
        <Button size="sm" variant="ghost" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button>
      </div>
    </div>}

    {/* Modules that are off by default in this fork keep their cards for anyone who turns them on. */}
    {on('motivation') && <RecapHomeCard S={S} />}
    <SeasonDeco spot="home-advent" />
    {on('motivation') && <WrappedHomeCard S={S} />}
    {on('health') && <RecoveryHint S={S} />}
    {on('motivation') && <ChallengesCard S={S} />}
    {on('checkin') && (
      <div className="card tap-host checkin-card">
        <CardHead icon="qr" tint="var(--blue)" eyebrow={t('At the gym')} title={t('Check in')} open={{ onClick: () => nav('/checkin') }}
          action={<Icon name="chevronRight" className="chev" />} />
      </div>
    )}
    {on('motivation') && <div className="card tap-host streak-card">
      <CardHead className="streak-head" glyph={<span className="streak-flame-wrap"><StreakFlame lit={streak.current > 0} /><SeasonDeco spot="streak-flame" /></span>}
        title={t('{0} week streak', streak.current)} open={{ onClick: () => calendarSheet(), haspopup: 'dialog' }}
        sub={<>{doneThisWeek}{plannedPerWeek ? ' / ' + plannedPerWeek : ''} {t('this week')} · {tn('{0} workout total', '{0} workouts total', S.workouts.length)}</>}
        action={<Icon name="calendar" className="chev" style={{ fontSize: 'var(--fs-title3)' }} />} />
      {(streak.best > 0 || streak.freezes > 0) && <div className="muted small card-head-indent streak-meta-line"><StreakMeta info={streak} /></div>}
      <StreakParty S={S} info={streak} tally={tally} />
    </div>}
    {S.homeMuscleSets === true && <div className="card wsets-solo"><WeeklySetsHomeLine S={S} onOpen={() => nav('/stats?section=lifts')} /></div>}
  </div>
}
