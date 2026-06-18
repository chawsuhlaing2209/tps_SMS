"use client";

import { Icon } from "../../app/lib/icon";

export type AppToastVariant = "success" | "error";

type AppToastProps = {
  variant: AppToastVariant;
  message: string;
  onClose: () => void;
};

const ICONS: Record<AppToastVariant, string> = {
  success: "check",
  error: "error"
};

export function AppToast({ variant, message, onClose }: AppToastProps) {
  return (
    <div className={`app-toast app-toast--${variant}`} role="status" aria-live="polite">
      <span className={`app-toast__icon app-toast__icon--${variant}`} aria-hidden="true">
        <Icon name={ICONS[variant]} size={14} filled />
      </span>
      <p className="app-toast__message">{message}</p>
      <button type="button" className="app-toast__close" onClick={onClose} aria-label="Dismiss">
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
