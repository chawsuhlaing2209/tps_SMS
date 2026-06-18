"use client";

import { useApiQuery } from "./api";

export type CurrentAcademicYear = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: string;
};

export function useCurrentAcademicYear() {
  return useApiQuery<CurrentAcademicYear | null>(
    (tenantId) => `/tenants/${tenantId}/dashboard/academic-year`
  );
}
