"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";
import { Icon } from "../../../app/lib/material-icon";
import { cn } from "../../../lib/utils";

const Modal = DialogPrimitive.Root;
const ModalTrigger = DialogPrimitive.Trigger;
const ModalClose = DialogPrimitive.Close;
const ModalPortal = DialogPrimitive.Portal;

const ModalOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn("pds-modal__overlay", className)} {...props} />
));
ModalOverlay.displayName = DialogPrimitive.Overlay.displayName;

export type ModalContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /** Set when no ModalDescription is rendered (Radix a11y). */
  "aria-describedby"?: string | undefined;
};

const ModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  ModalContentProps
>(({ className, children, ...props }, ref) => (
  <ModalPortal>
    <ModalOverlay />
    <DialogPrimitive.Content ref={ref} className={cn("pds-modal", className)} {...props}>
      {children}
    </DialogPrimitive.Content>
  </ModalPortal>
));
ModalContent.displayName = DialogPrimitive.Content.displayName;

const ModalHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("pds-modal__header", className)} {...props} />
);

const ModalTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("pds-type-title-m-extrabold pds-modal__title", className)} {...props} />
));
ModalTitle.displayName = DialogPrimitive.Title.displayName;

const ModalDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("pds-type-body-s-regular pds-modal__description", className)} {...props} />
));
ModalDescription.displayName = DialogPrimitive.Description.displayName;

function ModalCloseButton({ className, ...props }: React.ComponentPropsWithoutRef<typeof ModalClose>) {
  return (
    <ModalClose className={cn("pds-modal__close", className)} {...props}>
      <Icon name="close" size={20} />
      <span className="sr-only">Close</span>
    </ModalClose>
  );
}

const ModalBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("pds-modal__body", className)} {...props} />
);

const ModalFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("pds-modal__footer", className)} {...props} />
);

const ModalFooterStart = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("pds-modal__footer-start", className)} {...props} />
);

const ModalFooterActions = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("pds-modal__footer-actions", className)} {...props} />
);

export {
  Modal,
  ModalTrigger,
  ModalClose,
  ModalPortal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  ModalFooterStart,
  ModalFooterActions,
};
