"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function StudentsRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Forward any filter params (q, status, view, page, …) into the directory
    // so deep links and back navigation keep their state across the redirect.
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "students");
    router.replace(`/dashboard/people?${params.toString()}`);
  }, [router, searchParams]);

  return null;
}
