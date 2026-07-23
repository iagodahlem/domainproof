import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSignIn, useUser } from '@clerk/nextjs'
import { AuthCta } from './auth-cta'

vi.mock('@clerk/nextjs', () => ({
  useUser: vi.fn(),
  useSignIn: vi.fn(),
}))

const mockUseUser = vi.mocked(useUser)
const mockUseSignIn = vi.mocked(useSignIn)

function notLoaded() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for Clerk's discriminated-union hook return, matching only the fields AuthCta reads
  mockUseUser.mockReturnValue({ isLoaded: false, isSignedIn: undefined } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same as above
  mockUseSignIn.mockReturnValue({ isLoaded: false, signIn: undefined } as any)
}

function loaded(isSignedIn: boolean) {
  mockUseUser.mockReturnValue({
    isLoaded: true,
    isSignedIn,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double, only isLoaded/isSignedIn are read
  } as any)
  mockUseSignIn.mockReturnValue({
    isLoaded: true,
    signIn: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double, AuthCta only reads signIn
  } as any)
}

describe('AuthCta', () => {
  it('renders Dashboard linking to /app on first paint, before Clerk has loaded client-side', () => {
    notLoaded()
    render(<AuthCta initialIsSignedIn={true} />)

    const link = screen.getByRole('link', { name: /dashboard/i })
    expect(link.getAttribute('href')).toBe('/app')
    expect(
      screen.queryByRole('button', { name: /continue with google/i }),
    ).toBeNull()
  })

  it('renders a disabled Continue with Google on first paint for a signed-out visitor, before Clerk has loaded client-side', () => {
    notLoaded()
    render(<AuthCta initialIsSignedIn={false} />)

    expect(
      screen
        .getByRole('button', { name: /continue with google/i })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(screen.queryByRole('link', { name: /dashboard/i })).toBeNull()
  })

  it('trusts the live Clerk state once loaded, linking to /app', () => {
    loaded(true)
    render(<AuthCta initialIsSignedIn={false} />)

    const link = screen.getByRole('link', { name: /dashboard/i })
    expect(link.getAttribute('href')).toBe('/app')
  })

  it('renders an enabled Continue with Google once Clerk has loaded for a signed-out visitor', () => {
    loaded(false)
    render(<AuthCta initialIsSignedIn={false} />)

    expect(
      screen
        .getByRole('button', { name: /continue with google/i })
        .hasAttribute('disabled'),
    ).toBe(false)
  })
})
