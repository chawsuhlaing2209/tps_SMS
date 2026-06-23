"use client";

import "./modal-header-shell.css";
import type { ReactNode } from "react";
import { Icon } from "../../../app/lib/material-icon";
import { cn } from "../../../lib/utils";

export type ModalHeaderShellVariant = "default" | "withStepper" | "invoice";

export type ModalHeaderShellProps = {
  variant?: ModalHeaderShellVariant;
  title: ReactNode;
  description?: ReactNode;
  /** Rendered below copy when `variant="withStepper"`. */
  stepper?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  className?: string;
};

function ModalHeaderCloseButton({
  onClose,
  closeLabel,
  className,
}: {
  onClose?: () => void;
  closeLabel: string;
  className?: string;
}) {
  if (!onClose) return null;
  return (
    <button type="button" className={cn("pds-modal-header-shell__close", className)} onClick={onClose} aria-label={closeLabel}>
      <Icon name="close" size={20} />
    </button>
  );
}

/** Modal header variants — default title, wizard stepper, or invoice school branding (Figma 127:16021). */
export function ModalHeaderShell({
  variant = "default",
  title,
  description,
  stepper,
  onClose,
  closeLabel = "Close",
  className,
}: ModalHeaderShellProps) {
  if (variant === "invoice") {
    return (
      <header
        className={cn("pds-modal-header-shell pds-modal-header-shell--invoice", className)}
        data-figma-node="127:16022"
      >
        <div className="pds-modal-header-shell__brand">
          <div className="pds-modal-header-shell__brand-row">
            <span className="pds-modal-header-shell__logo" aria-hidden>
              <span className="pds-modal-header-shell__logo-mark" />
            </span>
            <h2 className="pds-type-title-m-extrabold pds-modal-header-shell__title">{title}</h2>
          </div>
          {description ? (
            <p className="pds-modal-header-shell__description">{description}</p>
          ) : null}
        </div>
        <ModalHeaderCloseButton onClose={onClose} closeLabel={closeLabel} />
      </header>
    );
  }

  return (
    <header
      className={cn(
        "pds-modal-header-shell",
        variant === "withStepper" && "pds-modal-header-shell--with-stepper",
        className,
      )}
      data-figma-node={variant === "withStepper" ? "127:16765" : "47:3031"}
    >
      <div className="pds-modal-header-shell__top">
        <div className="pds-modal-header-shell__copy">
          <h2 className="pds-type-title-m-extrabold pds-modal-header-shell__title">{title}</h2>
          {description ? (
            <p className="pds-type-body-s-regular pds-modal-header-shell__description">{description}</p>
          ) : null}
        </div>
        <ModalHeaderCloseButton onClose={onClose} closeLabel={closeLabel} />
      </div>
      {variant === "withStepper" && stepper ? stepper : null}
    </header>
  );
}
