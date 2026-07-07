"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function ClassroomDetailRedirectPage({
  params
}: {
  params: Promise<{ classroomId: string }>;
}) {
  const router = useRouter();
  const { classroomId } = use(params);

  useEffect(() => {
    router.replace(`/dashboard/structure/rooms/${classroomId}`);
  }, [classroomId, router]);

  return null;
}
