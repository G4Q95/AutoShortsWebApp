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
        source: '/api/preview',
        destination: 'http://backend:8000/api/v1/content/preview',
      },
      {
        source: '/api/projects/:projectId/process',
        destination: 'http://backend:8000/api/v1/projects/:projectId/process',
      },
      {
        source: '/api/:path*',
        destination: 'http://backend:8000/api/v1/:path*',
      },
      {
        source: '/health',
        destination: 'http://backend:8000/api/v1/health',
      },
    ];
  },
  // Add any other configuration options as needed
};

module.exports = nextConfig;