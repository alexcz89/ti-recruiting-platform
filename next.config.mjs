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
