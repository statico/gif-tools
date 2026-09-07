import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CATEGORIES, getTool, toolsIn } from "@/lib/tools";
import { JsonLd, toolJsonLd } from "@/lib/seo";

/** Shared chrome for every tool route: breadcrumb, heading, JSON-LD, siblings. */
export function ToolPage({ slug, children }: { slug: string; children: React.ReactNode }) {
  const tool = getTool(slug);
  const siblings = toolsIn(tool.category).filter((t) => t.slug !== slug);

  return (
    <>
      <JsonLd data={toolJsonLd(slug)} />
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex items-center gap-1 text-label text-muted-foreground tracking-wider uppercase">
          <li>
            <Link href="/" className="hover:text-foreground">
              home
            </Link>
          </li>
          <ChevronRight className="size-3" aria-hidden="true" />
          <li>{CATEGORIES[tool.category].label}</li>
          <ChevronRight className="size-3" aria-hidden="true" />
          <li aria-current="page" className="text-foreground">
            {tool.name}
          </li>
        </ol>
      </nav>

      <div className="mb-5">
        <h1 className="text-heading text-foreground tracking-tight mb-1.5">{tool.title}</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">{tool.description}</p>
      </div>

      {children}

      <section aria-labelledby="related" className="mt-10">
        <h2 id="related" className="smui-eyebrow mb-2">
          more {CATEGORIES[tool.category].label} tools
        </h2>
        <ul className="flex flex-wrap gap-2">
          {siblings.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/${t.slug}/`}
                className="inline-block border border-border px-2.5 py-1 text-ui text-muted-foreground hover:text-foreground hover:border-smui-border-hover transition-colors"
              >
                {t.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
