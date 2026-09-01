import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
      {
        source: '/account/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        source: '/business-portal/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
    ]
  },
}
export default nextConfig
