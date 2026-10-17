import { forwardRef } from 'react'
import { locale } from '../../lib/i18n'

const MULTIPLIERS: [string, number][] = [
  ['×1K', 1e3],
  ['×1M', 1e6],
  ['×1Md', 1e9],
  ['×1T', 1e12],
  ['×1Q', 1e15],
]

export function parseNumber(s: string): number {
  const n = Number(s.replace(/[\s  ]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return ''
  // une abeille pèse 0,0001 kg : sous 1, on garde les chiffres significatifs
  if (n > 0 && n < 1) return n.toLocaleString(locale(), { maximumSignificantDigits: 3 })
  return n.toLocaleString(locale(), { maximumFractionDigits: n < 10 ? 3 : n < 1000 ? 1 : 0 })
}

function reformat(raw: string): string {
  const clean = raw.replace(/[^\d,.]/g, '').replace('.', ',')
  const [int, dec] = clean.split(',')
  const grouped = (int || '').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return dec !== undefined ? `${grouped || '0'},${dec}` : grouped
}

interface Props {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  unit: string
  disabled?: boolean
  placeholder?: string
}

const NumberInput = forwardRef<HTMLInputElement, Props>(function NumberInput(
  { value, onChange, onSubmit, unit, disabled, placeholder = 'Ton estimation...' },
  ref,
) {
  return (
    <div className="num">
      <div className="num-field">
        <input
          ref={ref}
          inputMode="decimal"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(reformat(e.target.value))}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        />
        <span className="num-unit">{unit}</span>
      </div>
      <div className="num-chips">
        {MULTIPLIERS.map(([label, k]) => (
          <button
            key={label}
            disabled={disabled}
            onClick={() => {
              const n = parseNumber(value)
              onChange(formatNumber(Number.isFinite(n) && n > 0 ? n * k : k))
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
})

export default NumberInput
