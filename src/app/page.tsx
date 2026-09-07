import Link from "next/link";
import { CATEGORIES, TOOLS, type ToolCategory } from "@/lib/tools";
import { JsonLd } from "@/lib/seo";
import { SITE } from "@/lib/site";

const ORDER: ToolCategory[] = ["convert", "edit", "optimize", "emoji"];

export default function Home() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              name: SITE.name,
              url: `${SITE.url}/`,
              description: SITE.description,
              dateModified: new Date().toISOString(),
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: SITE.name, item: `${SITE.url}/` },
              ],
            },
          ],
        }}
      />

      <section className="mb-10 max-w-3xl">
        <p className="smui-eyebrow mb-1.5">gif toolkit</p>
        <h1 className="text-hero text-foreground tracking-tight leading-[1.1] mb-3">
          Every GIF tool, running in your browser.
        </h1>
        <p className="text-sm text-muted-foreground">
          {SITE.description} Results are kept in a local history so you can grab them again, and
          every download is named so it can be dropped straight into Slack.
        </p>
      </section>

      {ORDER.map((cat) => (
        <section key={cat} id={cat} className="mb-10 scroll-mt-16">
          <h2 className="text-heading text-foreground tracking-tight mb-0.5">
            {CATEGORIES[cat].label}
          </h2>
          <p className="text-ui text-muted-foreground mb-3">{CATEGORIES[cat].description}</p>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.filter((t) => t.category === cat).map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/${t.slug}/`}
                  className="card-glow block h-full border border-border bg-card p-3.5 hover:border-smui-border-hover"
                >
                  <span className="block text-ui text-foreground mb-1">{t.name}</span>
                  <span className="block text-label text-muted-foreground leading-relaxed normal-case tracking-normal">
                    {t.blurb}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
