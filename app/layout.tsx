// app/layout.tsx
import "./globals.css";
import "react-phone-input-2/lib/style.css";
import type { Metadata } from "next";

import { Inter } from "next/font/google";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import { ThemeScript } from "@/components/ThemeProvider";
import { generateOrganizationSchema, generateWebsiteSchema } from "@/lib/seo/schema";

// ✅ Font Optimization: Use variable font with display swap
// - display: 'swap' prevents invisible text while font loads (FOIT → FOUT)
// - Variable font reduces payload vs multiple weights
// - Weights: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)
const inter = Inter({
  subsets: ["latin"],
  display: "swap", // Prevents font flash while loading
  variable: "--font-inter", // CSS variable for usage
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.taskio.com.mx";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "TaskIO — Bolsa de trabajo TI en México",
    template: "%s | TaskIO",
  },
  description:
    "Encuentra las mejores vacantes de tecnología en México. Conectamos talento TI con empresas líderes.",
  // ✅ FIX: Canonical explícito — resuelve "Duplicate without user-selected canonical"
  alternates: {
    canonical: "/",
  },
  openGraph: {
    siteName: "TaskIO",
    locale: "es_MX",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const orgSchema = generateOrganizationSchema();
  const websiteSchema = generateWebsiteSchema();

  return (
    <html lang="es" suppressHydrationWarning className={`${inter.className} h-full`}>
      <head>
        <ThemeScript />
        <meta name="apple-mobile-web-app-title" content="TaskIO" />

        {/* ✅ Organization Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />

        {/* ✅ Website Schema with Search Action */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>

      <body className="min-h-screen antialiased bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <Providers>
          <Header />

          <main
            id="main-content"
            className="mx-auto max-w-7xl 2xl:max-w-screen-2xl px-4 sm:px-6 lg:px-8 pb-10"
          >
            {children}
          </main>

        </Providers>
      </body>
    </html>
  );
}