/**
 * Shared chrome for every notification email: dark-emerald header with the
 * wordmark, a white content card, a quiet footer. Built from plain
 * table/div markup with inline styles (rather than a components library)
 * for maximum email-client compatibility — see `@react-email/render`'s own
 * guidance on why table-based layout and inline styles remain the safest
 * baseline across mail clients.
 */

const BRAND = {
  emeraldDark: '#022c22',
  emerald: '#059669',
  bodyBg: '#f4f4f5',
  cardBg: '#ffffff',
  text: '#18181b',
  muted: '#71717a',
  border: '#e4e4e7',
}

interface EmailLayoutProps {
  preview: string
  children: React.ReactNode
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta content="text/html; charset=UTF-8" httpEquiv="Content-Type" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: BRAND.bodyBg,
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        }}
      >
        {/* Preview text: shown by mail clients' inbox preview, not the rendered body. */}
        <div
          style={{
            display: 'none',
            overflow: 'hidden',
            lineHeight: 1,
            opacity: 0,
            maxHeight: 0,
            maxWidth: 0,
          }}
        >
          {preview}
        </div>
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ backgroundColor: BRAND.bodyBg, padding: '32px 0' }}
        >
          <tbody>
            <tr>
              <td align="center">
                <table
                  role="presentation"
                  width="480"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{
                    width: '480px',
                    maxWidth: '90vw',
                    backgroundColor: BRAND.cardBg,
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: `1px solid ${BRAND.border}`,
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          backgroundColor: BRAND.emeraldDark,
                          padding: '20px 32px',
                        }}
                      >
                        <span
                          style={{
                            color: '#ffffff',
                            fontSize: '16px',
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                          }}
                        >
                          DomainProof
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '32px', color: BRAND.text }}>
                        {children}
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          padding: '16px 32px',
                          borderTop: `1px solid ${BRAND.border}`,
                        }}
                      >
                        <span style={{ color: BRAND.muted, fontSize: '12px' }}>
                          DomainProof — domain ownership verification
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  )
}

export const emailBrand = BRAND
