"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ClassroomDetailRedirectPage() {
  const router = useRouter();
  const params = useParams<{ classroomId: string }>();

  useEffect(() => {
    router.replace(`/dashboard/structure/rooms/${params.classroomId}`);
  }, [params.classroomId, router]);

  return null;
}
