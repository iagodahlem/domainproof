import type { DkimProbeResult } from '../probes/dkim-probe'
import type { DnsProbeResult } from '../probes/dns-probe'
import type { FetchProbeResult } from '../probes/fetch-probe'
import type { TlsProbeResult } from '../probes/tls-probe'

/** Every check below is a pure function of one shared probe context — the probes run once per scan, checks just interpret the results. */
export interface ProbeContext {
  fetch: FetchProbeResult
  tls: TlsProbeResult
  dns: DnsProbeResult
  dkim: DkimProbeResult
}
