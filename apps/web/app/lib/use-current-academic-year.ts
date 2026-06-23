"use client";

import { useReferenceApiQuery } from "./api";

export type CurrentAcademicYear = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: string;
};

export function useCurrentAcademicYear() {
  return useReferenceApiQuery<CurrentAcademicYear | null>(
    (tenantId) => `/tenants/${tenantId}/dashboard/academic-year`
  );
}
