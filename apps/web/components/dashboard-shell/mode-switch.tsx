'use client'

import { SegmentedControl } from '@domainproof/ui'
import type { SegmentedControlOption } from '@domainproof/ui'
import type { Mode } from '@/lib/api/dashboard'
import { useMode } from '@/lib/mode'

const MODE_OPTIONS: SegmentedControlOption[] = [
  { value: 'test', label: 'Test', tone: 'warning' },
  { value: 'live', label: 'Live', tone: 'success' },
]

/**
 * The dashboard-wide test/live switch — same warning/success tones the
 * mode-pill badges already use everywhere else, so flipping this and
 * seeing a row's pill change color reads as the same signal, not two
 * unrelated ones.
 */
export function ModeSwitch() {
  const { mode, setMode } = useMode()

  return (
    <SegmentedControl
      aria-label="Environment"
      options={MODE_OPTIONS}
      value={mode}
      onChange={(value) => setMode(value as Mode)}
      className="w-full justify-center"
    />
  )
}
