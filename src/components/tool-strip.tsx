"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TOOL_ICONS } from "@/components/tool-icons";
import { setHandoff } from "@/lib/history";
import { CATEGORIES, TOOLS, type ToolCategory } from "@/lib/tools";
import { cn } from "@/lib/utils";

const ORDER: ToolCategory[] = ["convert", "edit", "optimize", "emoji"];

/** What follows you to the next tool: the result if there is one, else the source. */
export interface Carry {
  file: File;
  kind: "source" | "result";
  /** Object URL for a thumbnail, when the file is an image. */
  url: string | null;
}

/**
 * Every tool in one row under the heading. With a file loaded, clicking
 * another tool opens it with that file already in place, the way ezgif chains
 * edits; without one it is plain navigation.
 */
export function ToolStrip({ current, carry }: { current: string; carry: Carry | null }) {
  const router = useRouter();
  // Keep the current tool in view: on a phone the row is wider than the screen.
  const activeRef = React.useRef<HTMLAnchorElement>(null);
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, []);
  const go = async (e: React.MouseEvent, href: string) => {
    if (!carry || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    await setHandoff(carry.file, carry.file.name);
    router.push(href);
  };

  return (
    <nav
      aria-label="Switch tool"
      className="sticky top-12 z-40 -mx-4 sm:-mx-6 mb-5 border-b border-border bg-card/95 backdrop-blur"
    >
      <div className="flex items-stretch overflow-x-auto px-4 sm:px-6 [scrollbar-width:thin]">
        {carry ? (
          <span
            className="mr-1 flex shrink-0 items-center gap-2 border-r border-border pr-3 text-label text-muted-foreground"
            title={`Pick a tool to continue with this ${carry.kind}`}
          >
            {carry.url ? (
              <img src={carry.url} alt="" className="checkerboard size-6 object-contain" />
            ) : null}
            <span className="whitespace-nowrap">
              {carry.kind} <span aria-hidden="true">→</span>
            </span>
          </span>
        ) : null}
        {ORDER.map((cat) => (
          <ul
            key={cat}
            aria-label={CATEGORIES[cat].label}
            className="flex shrink-0 border-l border-border first:border-l-0"
            style={{ "--tone": CATEGORIES[cat].tone } as React.CSSProperties}
          >
            {TOOLS.filter((t) => t.category === cat).map((t) => {
              const Icon = TOOL_ICONS[t.slug];
              const active = t.slug === current;
              return (
                <li key={t.slug}>
                  <Link
                    href={`/${t.slug}/`}
                    ref={active ? activeRef : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={(e) => void go(e, `/${t.slug}/`)}
                    className={cn(
                      "flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 text-label uppercase tracking-[1.5px] transition-colors",
                      active
                        ? "border-[hsl(var(--tone))] bg-[hsl(var(--tone)/0.1)] text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {Icon ? (
                      <Icon
                        className="size-3.5 shrink-0 text-[hsl(var(--tone))]"
                        aria-hidden="true"
                      />
                    ) : null}
                    {t.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </nav>
  );
}
