import { redirect } from "next/navigation";

export default async function YearGradeLegacyRedirectPage({
  params
}: {
  params: Promise<{ yearId: string; gradeId: string }>;
}) {
  const { gradeId } = await params;
  redirect(`/dashboard/academic-setup/grades-classrooms?grade=${gradeId}`);
}
