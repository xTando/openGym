// @vitest-environment happy-dom
// Stats in four parts (redesign 1.4.5, P5), shown as tabs in the fork: one part at a time, the
// picked part written into the address, ?section=all for the whole page.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Stats from './Stats.jsx'

const mocks = vi.hoisted(() => ({ S: null }))
vi.mock('../store/useStore.js', () => ({ useStore: selector => selector({ S: mocks.S }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../sheets.jsx', () => ({
  bwSheet: () => {}, goalSheet: () => {}, calendarSheet: () => {}, workoutDetailSheet: () => {}, exerciseHistorySheet: () => {},
  WorkoutRow: () => null, bwDeltaColor: () => 'inherit',
}))
vi.mock('../components/LineChart.jsx', () => ({ default: () => null }))
vi.mock('../components/Heatmap.jsx', () => ({ default: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null, BodyMapLegend: () => null }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const start = Date.now() - 2 * 86400000
const workout = { id: 'w1', d: new Date(start).toISOString().slice(0, 10), start, end: start + 3600000, name: 'Push',
  entries: [{ id: '0025', target: { id: '0025', sets: 1, reps: 5 }, sets: [{ w: 60, r: 5, done: true }] }] }
let root, host
afterEach(() => { act(() => root.unmount()); host.remove(); window.history.replaceState(null, '', '#/') })
function mount() {
  mocks.S = { body: 'male', effort: 'none', unit: 'kg', targetW: null, bodyweight: [], routines: [], exWeights: {}, workouts: [workout] }
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<Stats />))
}
const index = () => [...host.querySelectorAll('.stats-index .seg button')]

describe('Stats sections as tabs (fork)', () => {
  it('names the parts, and the overview is the only one drawn at first', () => {
    window.history.replaceState(null, '', '#/stats')
    mount()
    const parts = index().map(b => b.textContent)
    expect(parts.slice(0, 3)).toEqual(['Overview', 'Body', 'Lifts'])
    expect(host.querySelector('#stats-overview [data-tour="stats-tiles"]')).toBeTruthy()
    expect(host.querySelector('#stats-lifts')).toBeNull()
    expect(host.querySelector('#stats-body')).toBeNull()
  })
  it('a tap swaps the part, marks it and puts it in the address', () => {
    window.history.replaceState(null, '', '#/stats')
    mount()
    act(() => index()[2].click())
    expect(index()[2].getAttribute('aria-pressed')).toBe('true')
    expect(host.querySelector('#stats-lifts [data-tour="stats-records"]')).toBeTruthy()
    expect(host.querySelector('#stats-overview')).toBeNull()
    expect(window.location.hash).toBe('#/stats?section=lifts')
    act(() => index()[0].click())
    expect(window.location.hash).toBe('#/stats')
    expect(host.querySelector('#stats-overview')).toBeTruthy()
  })
  it('opens on the part the address names', () => {
    window.history.replaceState(null, '', '#/stats?section=body')
    mount()
    expect(index()[1].getAttribute('aria-pressed')).toBe('true')
    expect(host.querySelector('#stats-body [data-tour="stats-measure"]')).toBeTruthy()
  })
  it('section=all draws every part on one page, each with its heading', () => {
    window.history.replaceState(null, '', '#/stats?section=all')
    mount()
    const parts = index().map(b => b.textContent)
    expect([...host.querySelectorAll('.stats-sect-h')].map(h => h.textContent)).toEqual(parts.slice(1))
  })
})
