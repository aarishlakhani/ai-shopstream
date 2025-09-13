/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['placehold.co', 'cdn.shopify.com'],
  },
}

module.exports = nextConfig
