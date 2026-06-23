"use client";

import { useTranslations } from "next-intl";

export function WorkspaceLoading() {
  const c = useTranslations("common");
  return <p className="pds-type-body-s-regular muted">{c("loading")}</p>;
}
