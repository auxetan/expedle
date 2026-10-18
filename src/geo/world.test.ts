import { describe, expect, it } from 'vitest'
import { remaining, shortestPath } from './graph'
import { getWorld } from './world'

describe('world borders', () => {
  const w = getWorld()
  const n = (c: string) => w.neighbors.get(c) ?? new Set<string>()

  it('links countries by land, bridges and tunnels', () => {
    expect(n('FR').has('GB')).toBe(true)
    expect(n('DK').has('SE')).toBe(true)
    expect(n('IE').has('GB')).toBe(true)
    expect(n('HR').has('ME')).toBe(true)
    expect(n('RU').has('KP')).toBe(true)
  })

  it('keeps overseas regions apart from mainland France', () => {
    expect(n('FR').has('BR')).toBe(false)
    expect(n('GF').has('BR')).toBe(true)
    expect(n('MA').has('MR')).toBe(false)
  })

  it('does not let exclaves bridge their mainland', () => {
    expect(remaining(w.graph, 'PL', 'RU', new Set())).toBe(0)
    expect(remaining(w.graph, 'PL', 'LV', new Set(['RU']))).toBe(1)
    expect(remaining(w.graph, 'TR', 'AZ', new Set())).toBe(0)
    expect(remaining(w.graph, 'TR', 'RU', new Set(['AZ']))).toBe(1)
    expect(remaining(w.graph, 'ES', 'MA', new Set())).toBeGreaterThan(3)
  })

  it('matches the reference example routes', () => {
    expect(remaining(w.graph, 'ES', 'AT', new Set())).toBe(2)
    expect(shortestPath(w.graph, 'CF', 'TG')).toHaveLength(3)
  })
})
