import type { CSSProperties } from "react";

export type IconProps = {
  /** Material Symbols Rounded ligature name, e.g. "add", "groups", "calendar_month". */
  name: string;
  /** Render the filled variant. */
  filled?: boolean;
  /** Glyph size in px (sets font-size). */
  size?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * Renders a Material Symbols Rounded glyph. The font is loaded once in the
 * root layout; the ligature name is passed as text content.
 */
export function Icon({ name, filled, size, className, style }: IconProps) {
  const cls = ["ms", filled ? "fill" : null, className].filter(Boolean).join(" ");
  return (
    <span
      className={cls}
      aria-hidden="true"
      style={size ? { fontSize: size, ...style } : style}
    >
      {name}
    </span>
  );
}
