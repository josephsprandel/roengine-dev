/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/v0',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
 
}

export default nextConfig
