import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@domainproof/ui', '@domainproof/core'],
  async redirects() {
    return [
      // Bare `/dashboard/:projectId` (no sub-path) skips the extra hop
      // through the `[projectId]` index route's own redirect — straight to
      // the tab it would have landed on anyway.
      {
        source: '/dashboard/:projectId',
        destination: '/:projectId/domains',
        permanent: true,
      },
      {
        source: '/dashboard/:projectId/:path*',
        destination: '/:projectId/:path*',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
