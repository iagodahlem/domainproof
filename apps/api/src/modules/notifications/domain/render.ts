import { render } from '@react-email/render'
import type { ReactElement } from 'react'

export interface RenderedEmail {
  html: string
  text: string
}

/**
 * Renders a react-email template to both an HTML body and its plain-text
 * fallback — every `EmailMessage` (see `../ports.ts`) carries both, so a
 * client that doesn't render HTML still gets a readable email.
 */
export async function renderEmail(
  element: ReactElement,
): Promise<RenderedEmail> {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ])
  return { html, text }
}
