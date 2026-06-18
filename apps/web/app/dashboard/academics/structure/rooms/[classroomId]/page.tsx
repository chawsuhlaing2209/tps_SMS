import { redirect } from "next/navigation";

type Props = { params: Promise<{ classroomId: string }> };

export default async function LegacyStructureRoomRedirect({ params }: Props) {
  const { classroomId } = await params;
  redirect(`/dashboard/structure/rooms/${classroomId}`);
}
