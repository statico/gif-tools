import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { JsonLd, pageJsonLd } from "@/lib/seo";
import HistoryClient from "./client";

export const metadata: Metadata = {
  title: "Your history",
  description:
    "Everything you have made with gif.statico.io, kept in this browser only. Re-download any result or clear the lot.",
  alternates: {
    canonical: `${SITE.url}/history/`,
    types: { "text/markdown": `${SITE.url}/history.md` },
  },
  robots: { index: false, follow: true },
};

export default function Page() {
  return (
    <>
      <JsonLd data={pageJsonLd("history", "Your history", metadata.description as string)} />
      <h1 className="text-heading text-foreground tracking-tight mb-1.5">Your history</h1>
      <p className="text-sm text-muted-foreground max-w-3xl mb-5">
        The last 60 things you made, stored in this browser and nowhere else. Clearing your site
        data clears this list, and it does not follow you to other devices.
      </p>
      <h2 className="text-label text-muted-foreground tracking-[1.5px] uppercase mb-2">
        Saved results
      </h2>
      <HistoryClient />

      <h2 className="text-label text-muted-foreground tracking-[1.5px] uppercase mt-10 mb-2">
        Where this is stored
      </h2>
      <p className="text-sm text-muted-foreground max-w-3xl">
        The index lives in localStorage and the files themselves in IndexedDB, both under this
        site&rsquo;s origin. Nothing is uploaded, so the list is per-browser and per-device. The
        oldest entries are dropped once the list passes 60 items.
      </p>
    </>
  );
}
