import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import HistoryClient from "./client";

export const metadata: Metadata = {
  title: "Your history",
  description:
    "Everything you have made with gif.statico.io, kept in this browser only. Re-download any result or clear the lot.",
  alternates: { canonical: `${SITE.url}/history/` },
  robots: { index: false, follow: true },
};

export default function Page() {
  return (
    <>
      <h1 className="text-heading text-foreground tracking-tight mb-1.5">Your history</h1>
      <p className="text-sm text-muted-foreground max-w-3xl mb-5">
        The last 60 things you made, stored in this browser and nowhere else. Clearing your
        site data clears this list, and it does not follow you to other devices.
      </p>
      <HistoryClient />
    </>
  );
}
