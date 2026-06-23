"use client";

import type { FormEventHandler, ReactNode } from "react";
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalFooterActions,
  ModalFooterStart,
  ModalDescription,
  ModalTitle,
} from "../../components/pds/composites/modal";
import { ModalHeaderShell } from "../../components/pds/composites/modal-header-shell";
import { Icon } from "./material-icon";
import { cn } from "../../lib/utils";

export function RecordFormModal({
  open,
  onOpenChange,
  title,
  help,
  description,
  headerVariant = "default",
  stepper,
  headerIcon,
  onSubmit,
  children,
  footer,
  footerStart,
  size = "default",
  closeLabel,
  contentClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  help?: string;
  /** Static subtitle under the title (ceremony modals). */
  description?: string;
  headerVariant?: "default" | "withStepper";
  stepper?: ReactNode;
  headerIcon?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
  footer: ReactNode;
  /** Left-aligned footer slot (e.g. destructive tertiary action). */
  footerStart?: ReactNode;
  /** `wide` fits multi-section create/edit flows (e.g. enrollment ceremony). */
  size?: "default" | "wide";
  closeLabel?: string;
  /** Extra class on modal shell (e.g. domain-specific scroll/layout). */
  contentClassName?: string;
}) {
  const hasHelp = Boolean(help);
  const ceremonyHeader = headerVariant === "withStepper";

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        className={cn(
          "record-modal",
          size === "wide" && "record-modal--wide",
          ceremonyHeader && "record-modal--ceremony",
          ceremonyHeader && contentClassName,
        )}
        {...(hasHelp || ceremonyHeader ? {} : { "aria-describedby": undefined })}
      >
        <form
          className="entity-form entity-form--modal record-modal__form"
          onSubmit={onSubmit}
          noValidate
        >
          {ceremonyHeader ? (
            <ModalHeaderShell
              variant="withStepper"
              title={title}
              description={description}
              stepper={stepper}
              onClose={() => onOpenChange(false)}
              closeLabel={closeLabel}
            />
          ) : (
            <div className="pds-modal__header record-modal__header">
              <div className="record-modal__header-main">
                {headerIcon ? (
                  <span className="record-modal__header-icon" aria-hidden>
                    <Icon name={headerIcon} size={22} />
                  </span>
                ) : null}
                <div className="record-modal__header-copy">
                  <ModalTitle className="record-modal__title">{title}</ModalTitle>
                  {help ? (
                    <ModalDescription className="record-modal__help">{help}</ModalDescription>
                  ) : null}
                </div>
              </div>
              <ModalCloseButton />
            </div>
          )}
          <ModalBody className="record-modal__body">
            <div className="form-stack">{children}</div>
          </ModalBody>
          <ModalFooter className="record-modal__footer">
            <ModalFooterStart>{footerStart}</ModalFooterStart>
            <ModalFooterActions>{footer}</ModalFooterActions>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
