"use client";
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Uppercase smui field label wired to its control. */
export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-label text-muted-foreground tracking-[1.5px] uppercase block mb-1",
        className,
      )}
      {...p}
    />
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...p }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-9 w-full border border-input bg-background px-3 py-1 text-ui text-foreground",
      "placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-ui",
      className,
    )}
    {...p}
  />
));
Input.displayName = "Input";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...p }, ref) => (
  // Native select: keyboard, mobile and screen-reader behaviour for free.
  <select
    ref={ref}
    className={cn(
      "flex h-9 w-full border border-input bg-background px-3 py-1 text-ui text-foreground",
      "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:opacity-50",
      className,
    )}
    {...p}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export function Range({
  className,
  label,
  value,
  suffix,
  id,
  ...p
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; suffix?: string }) {
  // Generate an id when the caller doesn't supply one, so the visible label is
  // always programmatically associated with the input rather than just near it.
  const autoId = React.useId();
  const inputId = id ?? autoId;
  return (
    <div>
      {label ? (
        <div className="flex items-baseline justify-between mb-1">
          <Label htmlFor={inputId} className="mb-0">
            {label}
          </Label>
          <span className="text-label text-foreground tabular-nums" aria-hidden="true">
            {value}
            {suffix}
          </span>
        </div>
      ) : null}
      <input
        id={inputId}
        type="range"
        value={value}
        // The numeric readout is aria-hidden above; give AT the same info here.
        aria-valuetext={suffix ? `${value}${suffix}` : undefined}
        className={cn("w-full accent-primary h-9", className)}
        {...p}
      />
    </div>
  );
}

export function Checkbox({
  className,
  label,
  ...p
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  // The label wraps the box so the whole row is the hit target; a bare 16px
  // checkbox is under the 24px touch minimum.
  return (
    <label className="flex min-h-6 items-center gap-2 text-ui text-foreground select-none">
      <input type="checkbox" className={cn("size-4 accent-primary", className)} {...p} />
      {label}
    </label>
  );
}

/**
 * Colour swatch plus a hex input, kept in sync. With `clearable`, an X button
 * sets the value to "" meaning transparent / no colour, and the swatch shows a
 * checkerboard until a colour is picked again.
 */
export function ColorField({
  id,
  label,
  value,
  onChange,
  clearable = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  clearable?: boolean;
}) {
  const [text, setText] = React.useState(value);
  React.useEffect(() => setText(value), [value]);
  const none = clearable && value === "";
  const valid = /^#[0-9a-fA-F]{6}$/.test(text) || (clearable && text === "");
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <span
          className={cn("relative h-9 w-12 shrink-0", none && "checkerboard border border-input")}
        >
          <input
            id={id}
            type="color"
            value={none ? "#000000" : value}
            onChange={(e) => onChange(e.target.value)}
            className={cn("h-9 w-12 border border-input bg-background p-1", none && "opacity-0")}
          />
        </span>
        <Input
          aria-label={`${label} hex value`}
          value={text}
          placeholder={clearable ? "transparent" : undefined}
          spellCheck={false}
          aria-invalid={!valid}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            if (/^#[0-9a-fA-F]{6}$/.test(v) || (clearable && v === "")) onChange(v);
          }}
        />
        {clearable ? (
          <button
            type="button"
            aria-label={`${label}: none (transparent)`}
            aria-pressed={none}
            title="No colour (transparent)"
            disabled={none}
            onClick={() => onChange("")}
            className="h-9 w-9 shrink-0 border border-input text-muted-foreground hover:text-foreground hover:border-smui-border-hover disabled:opacity-40 disabled:hover:text-muted-foreground disabled:hover:border-input flex items-center justify-center"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The "this is what you will get" panel above a tool's run button: label/value
 * pairs derived from the same state that builds the encode arguments.
 */
export function Readout({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl
      aria-live="polite"
      className="grid grid-cols-2 gap-x-6 gap-y-2 border border-input p-3"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(9rem, 1fr))` }}
    >
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-label text-muted-foreground tracking-[1.5px] uppercase">{k}</dt>
          <dd className="text-ui text-foreground tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
