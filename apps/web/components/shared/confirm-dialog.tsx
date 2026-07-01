"use client";

import type { ReactNode } from "react";
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalFooterActions,
  ModalFooterStart,
  ModalHeader,
  ModalTitle,
} from "../pds/composites/modal";
import { Button } from "../ui/button";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  destructive?: boolean;
};

/** Confirmation preset built on the PDS Modal wrapper. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  loading,
  destructive,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
          <ModalCloseButton />
        </ModalHeader>
        <ModalBody>
          <ModalDescription className="pds-type-body-m-medium">{description}</ModalDescription>
        </ModalBody>
        <ModalFooter>
          <ModalFooterStart />
          <ModalFooterActions>
            <Button
              type="button"
              buttonType="outlined"
              buttonColor="secondary"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              buttonType="filled"
              buttonColor="primary"
              variant={destructive ? "destructive" : "default"}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? "Please wait…" : confirmLabel}
            </Button>
          </ModalFooterActions>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export type AppModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Optional intro copy rendered above `children` in the body. */
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Left-aligned footer slot (e.g. destructive tertiary action). */
  footerStart?: ReactNode;
  showClose?: boolean;
};

/** Generic centered modal wrapper — body accepts any content (forms, invoices, lists, etc.). */
export function AppModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  footerStart,
  showClose = true,
}: AppModalProps) {
  const hasDescription = Boolean(description);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent {...(hasDescription || children ? {} : { "aria-describedby": undefined })}>
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
          {showClose ? <ModalCloseButton /> : null}
        </ModalHeader>
        <ModalBody>
          {description ? <ModalDescription>{description}</ModalDescription> : null}
          {children}
        </ModalBody>
        {footer ? (
          <ModalFooter>
            <ModalFooterStart>{footerStart}</ModalFooterStart>
            <ModalFooterActions>{footer}</ModalFooterActions>
          </ModalFooter>
        ) : null}
      </ModalContent>
    </Modal>
  );
}
