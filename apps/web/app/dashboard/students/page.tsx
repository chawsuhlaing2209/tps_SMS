"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StudentsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/people?tab=students");
  }, [router]);

  return null;
}
