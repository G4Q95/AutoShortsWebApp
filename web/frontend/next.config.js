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
  // Add any other configuration options as needed
};

module.exports = nextConfig; 