import { redirect } from "next/navigation";

type Props = { params: Promise<{ yearId: string }> };

export default async function LegacyYearRedirect({ params }: Props) {
  const { yearId } = await params;
  redirect(`/dashboard/academic-setup/years/${yearId}`);
}
