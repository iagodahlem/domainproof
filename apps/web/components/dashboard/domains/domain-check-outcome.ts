export type CheckOutcomeTone = 'accent' | 'warning' | 'danger'

export interface CheckOutcomePresentation {
  tone: CheckOutcomeTone
  message: string
}

/**
 * Copy/tone for a `DomainCheck`/`domain.check_failed` outcome — shared by
 * the verify button's inline result and the event timeline, so a given
 * outcome reads the same wherever it shows up. `tone: 'accent'` for
 * `found` isn't a typo: `--accent` doubles as this product's success color
 * (see `tokens.css`'s comment on it) — matches how `Badge`/`StatusPill`
 * already treat the two tones as interchangeable for "this is true".
 */
const OUTCOME_PRESENTATION: Record<string, CheckOutcomePresentation> = {
  found: { tone: 'accent', message: 'Found the expected record.' },
  not_found: {
    tone: 'warning',
    message:
      "We didn't find the record yet — DNS can take a few minutes to propagate.",
  },
  wrong_value: {
    tone: 'danger',
    message: 'Found a TXT record, but the value does not match what we expect.',
  },
  unreachable: {
    tone: 'warning',
    message: "Couldn't reach DNS for this lookup. Try again shortly.",
  },
  expired: {
    tone: 'danger',
    message: "This challenge's verification window expired.",
  },
}

const FALLBACK_PRESENTATION: CheckOutcomePresentation = {
  tone: 'warning',
  message: 'Check completed with an unrecognized outcome.',
}

export function checkOutcomePresentation(
  outcome: string,
): CheckOutcomePresentation {
  return OUTCOME_PRESENTATION[outcome] ?? FALLBACK_PRESENTATION
}
