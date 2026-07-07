import type { AnchorHTMLAttributes, ReactNode } from "react";

/** Storybook stub for `next/link` — renders a plain anchor. */
export default function Link({
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
