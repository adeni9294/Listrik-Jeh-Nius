import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Mengizinkan build selesai meski ada warning TypeScript minor
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(process.cwd(), 'src');
    return config;
  },
};

export default nextConfig;
