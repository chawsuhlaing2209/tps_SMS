export type PeopleDirectoryCounts = {
  students: number;
  guardians: number;
  households: number;
};

export function peopleDirectoryCountsPath(tenantId: string) {
  return `/tenants/${tenantId}/students/directory-counts`;
}
