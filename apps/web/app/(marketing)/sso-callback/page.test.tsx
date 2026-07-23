import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth, useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { resolveActiveProjectPath } from '@/lib/project-resolution'
import SsoCallbackPage from './page'

vi.mock('@clerk/nextjs', () => ({
  useAuth: vi.fn(),
  useClerk: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))
vi.mock('@/lib/project-resolution', () => ({
  resolveActiveProjectPath: vi.fn(),
}))

const mockUseAuth = vi.mocked(useAuth)
const mockUseClerk = vi.mocked(useClerk)
const mockUseRouter = vi.mocked(useRouter)
const mockResolveActiveProjectPath = vi.mocked(resolveActiveProjectPath)

const replace = vi.fn()
const getToken = vi.fn()
const handleRedirectCallback = vi.fn()

/** Renders the page and returns the `customNavigate` fn it handed to Clerk. */
function renderAndCaptureNavigate() {
  render(<SsoCallbackPage />)
  const [, customNavigate] = handleRedirectCallback.mock.calls[0] as [
    unknown,
    (to: string) => Promise<void>,
  ]
  return customNavigate
}

describe('SsoCallbackPage', () => {
  beforeEach(() => {
    replace.mockReset()
    getToken.mockReset().mockResolvedValue('a-token')
    handleRedirectCallback.mockReset()
    mockResolveActiveProjectPath.mockReset()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double, only the fields the page reads
    mockUseRouter.mockReturnValue({ replace } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double, only getToken is read
    mockUseAuth.mockReturnValue({ getToken } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double, only handleRedirectCallback is read
    mockUseClerk.mockReturnValue({ handleRedirectCallback } as any)
  })

  it('calls handleRedirectCallback with the static fallback and a customNavigate override', () => {
    renderAndCaptureNavigate()

    expect(handleRedirectCallback).toHaveBeenCalledWith(
      {
        signInFallbackRedirectUrl: '/',
        signUpFallbackRedirectUrl: '/',
      },
      expect.any(Function),
    )
  })

  it('resolves the caller real project and navigates there once Clerk lands on the static fallback', async () => {
    mockResolveActiveProjectPath.mockResolvedValue('/acme-app')
    const customNavigate = renderAndCaptureNavigate()

    await customNavigate('/')

    expect(mockResolveActiveProjectPath).toHaveBeenCalledWith('a-token')
    expect(replace).toHaveBeenCalledWith('/acme-app')
  })

  it('resolves an absolute fallback URL the same way as a relative one', async () => {
    mockResolveActiveProjectPath.mockResolvedValue('/new')
    const customNavigate = renderAndCaptureNavigate()

    await customNavigate('http://localhost:3000/')

    expect(mockResolveActiveProjectPath).toHaveBeenCalledWith('a-token')
    expect(replace).toHaveBeenCalledWith('/new')
  })

  it('passes an in-flow navigation (e.g. pending 2FA) straight through, untouched', async () => {
    const customNavigate = renderAndCaptureNavigate()

    await customNavigate('/sign-in/factor-two')

    expect(mockResolveActiveProjectPath).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith('/sign-in/factor-two')
  })
})
