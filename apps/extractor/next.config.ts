import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@extraction/core',
    '@extraction/db',
    '@extraction/types',
    '@extraction/utils',
  ],
};

export default nextConfig;
