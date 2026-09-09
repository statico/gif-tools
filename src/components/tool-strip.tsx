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

// The strip sits above the heading (server-rendered, so the links are in the
// static HTML) while the file lives in the shell below it; this is the wire.
const CarryContext = React.createContext<(c: Carry | null) => void>(() => {});
const CarryValue = React.createContext<Carry | null>(null);

export function CarryProvider({ children }: { children: React.ReactNode }) {
  const [carry, setCarry] = React.useState<Carry | null>(null);
  return (
    <CarryContext.Provider value={setCarry}>
      <CarryValue.Provider value={carry}>{children}</CarryValue.Provider>
    </CarryContext.Provider>
  );
}

/** Publish the file that should follow the user to the next tool. */
export function usePublishCarry(carry: Carry | null) {
  const set = React.useContext(CarryContext);
  React.useEffect(() => {
    set(carry);
    return () => set(null);
  }, [carry, set]);
}

/**
 * Secondary nav under the site header: every tool on a wrapping bar. With a
 * file loaded, clicking another tool opens it with that file already in
 * place, the way ezgif chains edits; without one it is plain navigation.
 */
export function ToolStrip({ current }: { current: string }) {
  const router = useRouter();
  const carry = React.useContext(CarryValue);
  const go = async (e: React.MouseEvent, href: string) => {
    if (!carry || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    await setHandoff(carry.file, carry.file.name);
    router.push(href);
  };

  return (
    <nav
      aria-label="Switch tool"
      className="-mx-4 sm:-mx-6 -mt-6 mb-5 border-b border-border bg-card px-3 py-1.5 sm:px-5"
    >
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {carry ? (
          <span
            className="mr-2 flex items-center gap-2 border-r border-border pr-3 text-label text-muted-foreground"
            title={`Pick a tool to continue with this ${carry.kind}`}
          >
            {carry.url ? (
              <img src={carry.url} alt="" className="checkerboard size-5 object-contain" />
            ) : null}
            <span className="whitespace-nowrap">
              {carry.kind} <span aria-hidden="true">→</span>
            </span>
          </span>
        ) : null}
        {ORDER.map((cat) => (
          <ul key={cat} aria-label={CATEGORIES[cat].label} className="contents">
            {TOOLS.filter((t) => t.category === cat).map((t) => {
              const Icon = TOOL_ICONS[t.slug];
              const active = t.slug === current;
              return (
                <li key={t.slug} style={{ "--tone": CATEGORIES[cat].tone } as React.CSSProperties}>
                  <Link
                    href={`/${t.slug}/`}
                    aria-current={active ? "page" : undefined}
                    onClick={(e) => void go(e, `/${t.slug}/`)}
                    className={cn(
                      "flex h-7 items-center gap-1.5 whitespace-nowrap border px-2 text-label uppercase tracking-[1.5px] transition-colors",
                      active
                        ? "border-[hsl(var(--tone)/0.6)] bg-[hsl(var(--tone)/0.12)] text-foreground"
                        : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
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
