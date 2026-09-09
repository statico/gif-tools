import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme";
import { SiteFooter, SiteNav } from "@/components/site-nav";
import { CarryProvider, ToolStrip } from "@/components/tool-strip";
import { SITE } from "@/lib/site";
import "./globals.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

// Headings only. Freeware by Riciery Leal; same file the social card uses.
const vcr = localFont({ src: "./vcr-osd-mono.ttf", variable: "--font-vcr", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: `%s — ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  alternates: { canonical: `${SITE.url}/`, types: { "text/markdown": `${SITE.url}/index.md` } },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: SITE.title,
    description: SITE.description,
    url: `${SITE.url}/`,
    locale: SITE.locale,
  },
  twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceff4" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1e24" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${mono.variable} ${vcr.variable}`}>
      <body>
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:m-2 focus:border focus:border-primary focus:bg-card focus:px-3 focus:py-2 focus:text-ui"
          >
            Skip to content
          </a>
          <SiteNav />
          <CarryProvider>
            <ToolStrip />
            <main id="main" className="px-4 sm:px-6 py-6 max-w-7xl mx-auto w-full">
              {children}
            </main>
          </CarryProvider>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
