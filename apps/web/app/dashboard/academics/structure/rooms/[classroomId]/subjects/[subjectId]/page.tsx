import { redirect } from "next/navigation";

type Props = { params: Promise<{ classroomId: string; subjectId: string }> };

export default async function LegacySubjectRedirect({ params }: Props) {
  const { classroomId, subjectId } = await params;
  redirect(`/dashboard/structure/rooms/${classroomId}/subjects/${subjectId}`);
}
