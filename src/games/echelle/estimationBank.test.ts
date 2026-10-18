import { describe, expect, it } from 'vitest'
import { estimationBank } from './estimationBank'

describe('estimation bank', () => {
  it('holds well over a thousand positive estimates with unique ids', () => {
    const bank = estimationBank()
    expect(bank.length).toBeGreaterThan(1500)
    expect(new Set(bank.map((q) => q.id)).size).toBe(bank.length)
    expect(bank.every((q) => q.a > 0)).toBe(true)
  })
})
