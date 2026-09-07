import type { Metadata } from "next";
import { SITE } from "./site";
import { getTool } from "./tools";

const OG_IMAGE = { url: `${SITE.url}/opengraph-image`, width: 1200, height: 630, type: "image/png" };

export function toolMetadata(slug: string): Metadata {
  const tool = getTool(slug);
  const url = `${SITE.url}/${slug}/`;
  return {
    title: tool.title,
    description: tool.description,
    keywords: tool.keywords,
    alternates: { canonical: url, types: { "text/markdown": `${SITE.url}/${slug}.md` } },
    openGraph: {
      type: "website",
      url,
      siteName: SITE.name,
      title: tool.title,
      description: tool.description,
      locale: SITE.locale,
      // Declaring openGraph here replaces the root's, so the site-wide
      // opengraph-image has to be named again or tool pages share no card image.
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: tool.title,
      description: tool.description,
      images: [OG_IMAGE],
    },
  };
}

/** WebApplication + BreadcrumbList JSON-LD for a tool page. */
export function toolJsonLd(slug: string) {
  const tool = getTool(slug);
  const url = `${SITE.url}/${slug}/`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: tool.title,
        url,
        description: tool.description,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Any browser",
        browserRequirements: "Requires WebAssembly",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        isAccessibleForFree: true,
        dateModified: new Date().toISOString(),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE.name, item: `${SITE.url}/` },
          { "@type": "ListItem", position: 2, name: tool.name, item: url },
        ],
      },
    ],
  };
}

/** WebPage + BreadcrumbList JSON-LD for a plain page (glossary, history). */
export function pageJsonLd(slug: string, name: string, description: string, extra?: object) {
  const url = `${SITE.url}/${slug}/`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name,
        url,
        description,
        isPartOf: { "@type": "WebSite", name: SITE.name, url: `${SITE.url}/` },
        dateModified: new Date().toISOString(),
        ...extra,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE.name, item: `${SITE.url}/` },
          { "@type": "ListItem", position: 2, name, item: url },
        ],
      },
    ],
  };
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
