"use client";

import { toast as sonnerToast } from "sonner";
import { AppToast, type AppToastVariant } from "../../components/shared/app-toast";
import { ApiError } from "./api";

const TOAST_DURATION_MS = 4000;

function showToast(variant: AppToastVariant, message: string) {
  sonnerToast.custom(
    (id) => (
      <AppToast variant={variant} message={message} onClose={() => sonnerToast.dismiss(id)} />
    ),
    { duration: TOAST_DURATION_MS }
  );
}

export function toastSuccess(message: string) {
  showToast("success", message);
}

export function toastError(error: unknown, fallback = "Something went wrong.") {
  const message =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : fallback;
  showToast("error", message);
}
