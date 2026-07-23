const STYLE_ELEMENT_ID = 'domainproof-react-styles'

/**
 * `.dp-*` classnames, `--dp-*` custom properties with sensible defaults
 * baked in via `var(--dp-x, <default>)` — a consumer that sets none of
 * them still gets a fully styled card; setting one on any ancestor element
 * re-themes every instance beneath it. See README.md's theming table for
 * the full variable list.
 */
const CSS = `
.dp-card {
  font-family: var(--dp-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif);
  color: var(--dp-color-text, #0f172a);
  background: var(--dp-color-bg, #ffffff);
  border: 1px solid var(--dp-color-border, #e2e8f0);
  border-radius: var(--dp-radius, 10px);
  padding: 20px;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
}
.dp-card *,
.dp-card *::before,
.dp-card *::after {
  box-sizing: border-box;
}
.dp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.dp-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  word-break: break-all;
}
.dp-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
}
.dp-badge--pending {
  color: var(--dp-color-warning, #b45309);
  background: var(--dp-color-warning-bg, #fffbeb);
}
.dp-badge--success {
  color: var(--dp-color-success, #15803d);
  background: var(--dp-color-success-bg, #f0fdf4);
}
.dp-badge--warning {
  color: var(--dp-color-warning, #b45309);
  background: var(--dp-color-warning-bg, #fffbeb);
}
.dp-badge--danger {
  color: var(--dp-color-danger, #b91c1c);
  background: var(--dp-color-danger-bg, #fef2f2);
}
.dp-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
  animation: dp-pulse 1.5s ease-in-out infinite;
}
@keyframes dp-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
.dp-body-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--dp-color-text-muted, #64748b);
  margin: 0;
}
.dp-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dp-input-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dp-color-text-muted, #64748b);
}
.dp-input {
  font: inherit;
  font-size: 14px;
  padding: 8px 10px;
  border: 1px solid var(--dp-color-border, #e2e8f0);
  border-radius: calc(var(--dp-radius, 10px) - 4px);
  background: var(--dp-color-bg, #ffffff);
  color: var(--dp-color-text, #0f172a);
}
.dp-input:focus {
  outline: 2px solid var(--dp-color-accent, #2563eb);
  outline-offset: 1px;
}
.dp-button {
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: calc(var(--dp-radius, 10px) - 4px);
  border: 1px solid var(--dp-color-border, #e2e8f0);
  background: var(--dp-color-bg-muted, #f8fafc);
  color: var(--dp-color-text, #0f172a);
  cursor: pointer;
}
.dp-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.dp-button--primary {
  background: var(--dp-color-accent, #2563eb);
  border-color: var(--dp-color-accent, #2563eb);
  color: var(--dp-color-accent-contrast, #ffffff);
}
.dp-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--dp-color-bg-muted, #f8fafc);
  border: 1px solid var(--dp-color-border, #e2e8f0);
  border-radius: calc(var(--dp-radius, 10px) - 4px);
}
.dp-field-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dp-field-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dp-color-text-muted, #64748b);
  flex-shrink: 0;
  width: 40px;
}
.dp-field-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
  flex: 1;
}
.dp-copy-button {
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--dp-color-border, #e2e8f0);
  background: var(--dp-color-bg, #ffffff);
  color: var(--dp-color-text-muted, #64748b);
  cursor: pointer;
  flex-shrink: 0;
}
.dp-error-text {
  font-size: 12px;
  color: var(--dp-color-danger, #b91c1c);
  margin: 0;
}
.dp-footer-text {
  font-size: 11px;
  color: var(--dp-color-text-muted, #64748b);
}
`

/** Injects the stylesheet above into `document.head` at most once, regardless of how many `<DomainVerification />` instances mount — a no-op during SSR (no `document`). */
export function injectDomainProofStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ELEMENT_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ELEMENT_ID
  style.textContent = CSS
  document.head.appendChild(style)
}
