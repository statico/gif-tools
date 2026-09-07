import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { TOOLS } from "@/lib/tools";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE.url}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/glossary/`, lastModified, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE.url}/history/`, lastModified, changeFrequency: "monthly", priority: 0.3 },
    ...TOOLS.map((t) => ({
      url: `${SITE.url}/${t.slug}/`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
