import { describe, expect, it } from 'vitest'
import { disallowedIpReason, isDisallowedIp } from './ip-guard'

describe('isDisallowedIp', () => {
  const allowed = [
    '93.184.216.34', // example.com
    '8.8.8.8',
    '1.1.1.1',
    '2606:2800:220:1:248:1893:25c8:1946', // example.com AAAA
  ]

  it.each(allowed)('allows an ordinary public address: %s', (ip) => {
    expect(isDisallowedIp(ip)).toBe(false)
  })

  const disallowed: Array<[string, string]> = [
    ['127.0.0.1', 'loopback'],
    ['127.0.0.53', 'loopback'],
    ['10.0.0.1', 'private'],
    ['10.255.255.255', 'private'],
    ['172.16.0.1', 'private'],
    ['172.31.255.255', 'private'],
    ['192.168.1.1', 'private'],
    ['169.254.169.254', 'link_local'], // cloud metadata
    ['169.254.0.1', 'link_local'],
    ['100.64.0.1', 'cgnat'],
    ['100.127.255.255', 'cgnat'],
    ['0.0.0.0', 'unspecified'],
    ['0.1.2.3', 'reserved'],
    ['224.0.0.1', 'multicast'],
    ['240.0.0.1', 'reserved'],
    ['255.255.255.255', 'reserved'],
    ['192.0.2.1', 'reserved'], // TEST-NET-1
    ['198.51.100.1', 'reserved'], // TEST-NET-2
    ['203.0.113.1', 'reserved'], // TEST-NET-3
    ['198.18.0.1', 'reserved'], // benchmarking
    ['::1', 'loopback'],
    ['::', 'unspecified'],
    ['fc00::1', 'private'], // unique local
    ['fd00::1', 'private'],
    ['fe80::1', 'link_local'],
    ['fe80::abcd:1234', 'link_local'],
    ['ff02::1', 'multicast'],
    ['::ffff:127.0.0.1', 'loopback'], // IPv4-mapped loopback
    ['::ffff:10.0.0.1', 'private'], // IPv4-mapped private
    ['::ffff:169.254.169.254', 'link_local'], // IPv4-mapped metadata
  ]

  it.each(disallowed)('rejects %s as %s', (ip, reason) => {
    expect(isDisallowedIp(ip)).toBe(true)
    expect(disallowedIpReason(ip)).toBe(reason)
  })

  it('boundary: 172.15.x and 172.32.x are outside the private range', () => {
    expect(isDisallowedIp('172.15.255.255')).toBe(false)
    expect(isDisallowedIp('172.32.0.0')).toBe(false)
  })

  it('boundary: 100.63.x and 100.128.x are outside the CGNAT range', () => {
    expect(isDisallowedIp('100.63.255.255')).toBe(false)
    expect(isDisallowedIp('100.128.0.0')).toBe(false)
  })

  it('fails closed on a string that is not a valid IP literal', () => {
    expect(isDisallowedIp('not-an-ip')).toBe(true)
    expect(disallowedIpReason('not-an-ip')).toBe('reserved')
  })
})
