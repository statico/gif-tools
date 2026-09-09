"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TOOL_ICONS } from "@/components/tool-icons";
import { sourceHref, stashSource } from "@/lib/history";
import { CATEGORIES, TOOLS, type ToolCategory } from "@/lib/tools";
import { cn } from "@/lib/utils";

const ORDER: ToolCategory[] = ["convert", "edit", "optimize", "emoji"];

export interface CarryItem {
  file: File;
  /** Object URL for a thumbnail, when the file is an image. */
  url: string | null;
}

/** What can follow you to the next tool; the strip's switch picks which. */
export interface Carry {
  source: CarryItem | null;
  result: CarryItem | null;
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
export function ToolStrip() {
  const router = useRouter();
  const carry = React.useContext(CarryValue);
  const [pick, setPick] = React.useState<"source" | "result">("result");
  const current = usePathname().split("/")[1];
  if (!TOOLS.some((t) => t.slug === current)) return null;
  const chosen = carry?.result && pick === "result" ? carry.result : (carry?.source ?? null);
  const go = async (e: React.MouseEvent, slug: string) => {
    if (!chosen || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    router.push(sourceHref(slug, await stashSource(chosen.file, chosen.file.name)));
  };

  return (
    <nav aria-label="Switch tool" className="border-b border-border bg-card px-3 py-1.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
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
                    onClick={(e) => void go(e, t.slug)}
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
        {carry ? (
          <div
            role="radiogroup"
            aria-label="File to pass to the next tool"
            className="ml-auto flex items-center border border-border pl-2 text-label text-muted-foreground"
          >
            <span className="mr-1 whitespace-nowrap">next tool gets</span>
            {(["source", "result"] as const).map((kind) => {
              const item = carry[kind];
              const on = chosen === item;
              return (
                <button
                  key={kind}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!item}
                  onClick={() => setPick(kind)}
                  className={cn(
                    "flex h-7 items-center gap-1.5 px-2 uppercase tracking-[1.5px] transition-colors disabled:opacity-40",
                    on ? "bg-secondary text-foreground" : "hover:text-foreground",
                  )}
                >
                  {item?.url ? (
                    <img src={item.url} alt="" className="checkerboard size-4 object-contain" />
                  ) : null}
                  {kind}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
