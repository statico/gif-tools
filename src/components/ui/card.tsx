import * as React from "react";
import { cn } from "@/lib/utils";

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("card-glow border border-border bg-card text-card-foreground", className)}
    {...p}
  />
);
export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-row items-center justify-between gap-2 py-2.5 px-3.5 border-b border-border",
      className,
    )}
    {...p}
  />
);
export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2
    className={cn(
      "text-xs text-muted-foreground tracking-[1.5px] uppercase font-normal",
      className,
    )}
    {...p}
  />
);
export const CardContent = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-3.5", className)} {...p} />
);
