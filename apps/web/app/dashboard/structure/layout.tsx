"use client";

import type { ReactNode } from "react";

export default function StructureLayout({ children }: { children: ReactNode }) {
  return <div className="page-stack page-stack--structure">{children}</div>;
}
