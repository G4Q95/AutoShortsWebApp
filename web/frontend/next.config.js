/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'localhost',
      'i.redd.it',
      'preview.redd.it',
      'external-preview.redd.it',
      'b.thumbs.redditmedia.com',
      'i.imgur.com'
    ],
  },
  // Add rewrites for the backend API
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
      {
        source: '/health',
        destination: 'http://localhost:8000/health',
      },
    ];
  },
  // Add any other configuration options as needed
};

module.exports = nextConfig; 