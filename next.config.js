/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  swcMinify: false,
  webpack: (config) => {
    config.cache = false;
    config.parallelism = 1;
    return config;
  },
};

module.exports = nextConfig;
