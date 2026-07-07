"use client";

import type { ComponentProps } from "react";
import { RecordFormModal } from "./record-modal";

export type RecordFormSheetProps = ComponentProps<typeof RecordFormModal>;

/** Centered modal form — replaces the legacy right-side sheet for all create/edit flows. */
export function RecordFormSheet(props: RecordFormSheetProps) {
  return <RecordFormModal {...props} />;
}
