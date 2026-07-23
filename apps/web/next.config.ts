import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@domainproof/ui', '@domainproof/core'],
  async redirects() {
    return [
      // Bare `/dashboard/:projectId` (no sub-path) maps straight to the
      // project root, same as `/:path*` below would for an empty path.
      {
        source: '/dashboard/:projectId',
        destination: '/:projectId',
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
