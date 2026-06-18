"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ClassroomsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/structure");
  }, [router]);

  return null;
}
