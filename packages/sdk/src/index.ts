/**
 * Result tuple returned by every DomainProof SDK call — never throws,
 * callers branch on whichever of `data`/`error` is set.
 */
export type Result<T> =
  | { data: T; error: null }
  | { data: null; error: Error };

export interface DomainProofConfig {
  apiKey: string;
}

/**
 * DomainProof API client stub. Constructor only stores config for now —
 * the real request/verification surface lands once the SDK talks to the
 * live API.
 */
export class DomainProof {
  private readonly config: DomainProofConfig;

  constructor(config: DomainProofConfig) {
    this.config = config;
  }

  get apiKey(): string {
    return this.config.apiKey;
  }
}
