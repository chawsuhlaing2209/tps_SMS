"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSession, isPlatformSession } from "../lib/session";

export default function PlatformIndexPage() {
  const router = useRouter();

  useEffect(() => {
    const session = getSession();
    router.replace(isPlatformSession(session) ? "/platform/tenants" : "/platform/login");
  }, [router]);

  return null;
}
