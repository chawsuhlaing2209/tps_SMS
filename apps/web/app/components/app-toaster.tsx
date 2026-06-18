"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="bottom-center"
      duration={4000}
      offset={24}
      gap={12}
      visibleToasts={3}
      expand={false}
      closeButton={false}
      richColors={false}
      toastOptions={{ unstyled: true }}
    />
  );
}
