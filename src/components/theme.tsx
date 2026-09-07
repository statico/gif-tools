"use client";
import * as React from "react";
import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}

const ORDER = ["light", "dark", "system"] as const;
const ICON = { light: Sun, dark: Moon, system: Monitor };

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Before hydration we don't know the resolved theme; render a stable
  // placeholder so the button doesn't flip icons on mount.
  const current = (mounted ? theme : "system") as keyof typeof ICON;
  const Icon = ICON[current] ?? Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Theme: ${current}. Click to change.`}
      title={`Theme: ${current}`}
      onClick={() => setTheme(ORDER[(ORDER.indexOf(current as never) + 1) % ORDER.length])}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
