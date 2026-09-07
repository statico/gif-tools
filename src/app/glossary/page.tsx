import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import { JsonLd, pageJsonLd } from "@/lib/seo";
import { TOOLS } from "@/lib/tools";
import { TERMS } from "@/lib/glossary";

export const metadata: Metadata = {
  title: "GIF glossary",
  description:
    "Plain definitions of the terms these tools use: palette, dithering, frame delay, lossy compression, APNG, WebP, colour quantisation and Slack emoji limits.",
  alternates: {
    canonical: `${SITE.url}/glossary/`,
    types: { "text/markdown": `${SITE.url}/glossary.md` },
  },
};

export default function Page() {
  return (
    <>
      <JsonLd
        data={pageJsonLd("glossary", "GIF glossary", metadata.description as string, {
          mainEntity: {
            "@type": "DefinedTermSet",
            name: "GIF glossary",
            hasDefinedTerm: TERMS.map((t) => ({
              "@type": "DefinedTerm",
              name: t.term,
              description: t.body,
            })),
          },
        })}
      />
      <h1 className="text-heading text-foreground tracking-tight mb-1.5">GIF glossary</h1>
      <p className="text-sm text-muted-foreground max-w-3xl mb-6">
        The terms these tools use, defined once. Every setting on every page means one of these
        things.
      </p>
      <dl className="max-w-3xl space-y-5">
        {TERMS.map((t) => (
          <div key={t.term} className="border-l-2 border-border pl-4">
            <dt>
              <h2 className="text-label text-foreground tracking-wider uppercase mb-1">{t.term}</h2>
            </dt>
            <dd className="text-sm text-muted-foreground">
              {t.body}
              {t.see ? (
                <>
                  {" "}
                  <Link href={`/${t.see}/`} className="text-primary underline underline-offset-2">
                    {TOOLS.find((x) => x.slug === t.see)?.name}
                  </Link>
                </>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
