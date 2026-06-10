// next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ["*"] },
    serverComponentsExternalPackages: ["unpdf", "pdfjs-dist"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "utfs.io",
      },
    ],
  },

  // ✅ Compression: Enable brotli compression for smaller responses
  compress: true,

  // ✅ Trailing slash consistency
  trailingSlash: false,

  // ✅ HTTP response headers for caching and security
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=60, s-maxage=3600", // 1 min client, 1 hour CDN
          },
          {
            key: "Content-Encoding",
            value: "gzip", // Gzip compression
          },
        ],
      },
      {
        source: "/jobs/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, s-maxage=86400", // 5 min client, 24h CDN
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
      {
        source: "/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable", // 1 year (immutable)
          },
        ],
      },
      {
        // ✅ Security headers for all pages
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), camera=()",
          },
        ],
      },
    ];
  },

  // ✅ FIX: Redirect no-www → www (301 permanente)
  // Resuelve "Duplicate without user-selected canonical" en Google Search Console
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "taskio.com.mx" }],
        destination: "https://www.taskio.com.mx/:path*",
        permanent: true, // 301
      },
    ];
  },
};

export default nextConfig;
