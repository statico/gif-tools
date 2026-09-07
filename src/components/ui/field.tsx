"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Uppercase smui field label wired to its control. */
export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-label text-muted-foreground tracking-[1.5px] uppercase block mb-1", className)}
      {...p}
    />
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => (
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
  ),
);
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
  const id = React.useId();
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        className={cn("size-4 accent-primary", className)}
        {...p}
      />
      <label htmlFor={id} className="text-ui text-foreground select-none">
        {label}
      </label>
    </div>
  );
}
