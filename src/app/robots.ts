import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Everything here is free, static and public — agents included.
      { userAgent: "*", allow: "/" },
    ],
    sitemap: [`${SITE.url}/sitemap.xml`],
    host: SITE.url,
  };
}
