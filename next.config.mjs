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
      // ─── API Endpoints: Jobs, Applications, etc
      {
        source: "/api/jobs",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=30, s-maxage=300, stale-while-revalidate=3600",
          },
          { key: "Vary", value: "Accept-Encoding" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/api/applications",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=60, must-revalidate",
          },
          { key: "Vary", value: "Accept-Encoding" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
          },
          { key: "Vary", value: "Accept-Encoding" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },

      // ─── Static Pages: Jobs, Profile, etc
      {
        source: "/jobs/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
          },
          { key: "Vary", value: "Accept-Encoding" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/dashboard/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, max-age=0, must-revalidate",
          },
        ],
      },

      // ─── Static Assets: Images, Fonts (Long-term caching)
      {
        source: "/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          { key: "Vary", value: "Accept-Encoding" },
        ],
      },
      {
        source: "/:path*\\.(jpg|jpeg|png|gif|webp|svg|woff|woff2|ttf|eot)$",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          { key: "Vary", value: "Accept-Encoding" },
        ],
      },

      // ─── Security headers for all pages
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
          // Enable compression for all responses
          { key: "Accept-Encoding", value: "gzip, deflate, br" },
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
