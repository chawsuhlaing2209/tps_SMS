import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export type ChipProps = {
  children: ReactNode;
  /** Optional leading dot color (e.g. subject color). */
  dotColor?: string;
  className?: string;
};

/**
 * Compact, read-only tag for enumerating values inline — grade levels on a
 * subject row, categories on a role, tags on a discount. Display-only; see
 * docs/COMPONENTS.md. For selectable pills use `OptionChip` instead.
 */
export function Chip({ children, dotColor, className }: ChipProps) {
  return (
    <span className={cn("pds-type-label-s-bold chip", className)}>
      {dotColor ? <span className="chip__dot" style={{ background: dotColor }} aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Wrap-flow container for a set of `Chip`s with consistent gap. */
export function ChipGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("chip-group", className)}>{children}</span>;
}
