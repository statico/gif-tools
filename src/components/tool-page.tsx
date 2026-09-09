import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CATEGORIES, getTool } from "@/lib/tools";
import { JsonLd, toolJsonLd } from "@/lib/seo";

/** Shared chrome for every tool route: breadcrumb, heading, JSON-LD, siblings. */
export function ToolPage({ slug, children }: { slug: string; children: React.ReactNode }) {
  const tool = getTool(slug);

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
          <li style={{ color: `hsl(${CATEGORIES[tool.category].tone})` }}>
            {CATEGORIES[tool.category].label}
          </li>
          <ChevronRight className="size-3" aria-hidden="true" />
          <li aria-current="page" className="text-foreground">
            {tool.name}
          </li>
        </ol>
      </nav>

      <div className="mb-5">
        <h1 className="font-display text-heading text-foreground mb-1.5">{tool.title}</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">{tool.description}</p>
      </div>

      {children}
    </>
  );
}
