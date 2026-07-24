import { promises as dns } from 'node:dns'
import type { CaaRecord } from 'node:dns'

export interface DnsResolverLike {
  resolveMx: typeof dns.resolveMx
  resolveTxt: typeof dns.resolveTxt
  resolveNs: typeof dns.resolveNs
  resolveCaa: typeof dns.resolveCaa
}

export const nodeDnsResolver: DnsResolverLike = dns

export interface DnsProbeResult {
  mx: string[]
  txt: string[][]
  ns: string[]
  caa: CaaRecord[]
  dmarcTxt: string[][]
}

/** Every DNS record type the DNS-derived checks need, resolved once in parallel. A lookup miss is a normal, expected outcome (most domains have no CAA record, plenty have no DMARC) — never thrown, just an empty result for that record type. */
export async function runDnsProbe(
  domain: string,
  resolver: DnsResolverLike = nodeDnsResolver,
): Promise<DnsProbeResult> {
  const [mx, txt, ns, caa, dmarcTxt] = await Promise.all([
    resolver.resolveMx(domain).catch(() => []),
    resolver.resolveTxt(domain).catch(() => []),
    resolver.resolveNs(domain).catch(() => []),
    resolver.resolveCaa(domain).catch(() => []),
    resolver.resolveTxt(`_dmarc.${domain}`).catch(() => []),
  ])

  return {
    mx: mx.map((record) => record.exchange),
    txt,
    ns,
    caa,
    dmarcTxt,
  }
}
