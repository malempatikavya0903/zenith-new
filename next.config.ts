/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ⬇️ DISABLE TypeScript errors during build
  typescript: {
    ignoreBuildErrors: true,
  },
  // ⬇️ DISABLE ESLint errors during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;