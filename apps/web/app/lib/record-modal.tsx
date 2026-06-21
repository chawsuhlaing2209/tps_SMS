"use client";

import type { FormEventHandler, ReactNode } from "react";
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
} from "../../components/pds/composites/modal";
import { Icon } from "./material-icon";
import { cn } from "../../lib/utils";

export function RecordFormModal({
  open,
  onOpenChange,
  title,
  help,
  headerIcon,
  onSubmit,
  children,
  footer,
  size = "default",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  help?: string;
  headerIcon?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
  footer: ReactNode;
  /** `wide` fits multi-section create/edit flows (e.g. student registration). */
  size?: "default" | "wide";
}) {
  const hasHelp = Boolean(help);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        className={cn("record-modal", size === "wide" && "record-modal--wide")}
        {...(hasHelp ? {} : { "aria-describedby": undefined })}
      >
        <form
          className="entity-form entity-form--modal record-modal__form"
          onSubmit={onSubmit}
          noValidate
        >
          <ModalHeader className="record-modal__header">
            <div className="record-modal__header-main">
              {headerIcon ? (
                <span className="record-modal__header-icon" aria-hidden>
                  <Icon name={headerIcon} size={22} />
                </span>
              ) : null}
              <ModalTitle className="record-modal__title">{title}</ModalTitle>
            </div>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody className="record-modal__body">
            {help ? <ModalDescription className="record-modal__help">{help}</ModalDescription> : null}
            <div className="form-stack">{children}</div>
          </ModalBody>
          <ModalFooter className="record-modal__footer">
            <ModalFooterStart />
            <ModalFooterActions>{footer}</ModalFooterActions>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
