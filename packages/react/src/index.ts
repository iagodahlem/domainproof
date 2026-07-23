export { DomainProofProvider } from './provider'
export type { DomainProofProviderProps } from './provider'

export { useClaimDomain } from './use-claim-domain'
export type {
  UseClaimDomainOptions,
  UseClaimDomainResult,
  UseClaimDomainStatus,
} from './use-claim-domain'

export { useVerification } from './use-verification'
export type {
  UseVerificationFetchStatus,
  UseVerificationOptions,
  UseVerificationResult,
} from './use-verification'

export { DomainVerification } from './domain-verification'
export type { DomainVerificationProps } from './domain-verification'

export { DEFAULT_BASE_URL } from './client'

export type {
  ClaimResult,
  DomainProofError,
  DomainStatus,
  Provider,
  Verification,
  VerificationCheck,
  VerificationRecord,
} from './types'
