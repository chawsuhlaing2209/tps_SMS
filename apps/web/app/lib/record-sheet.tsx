"use client";

import type { FormEventHandler, ReactNode } from "react";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "../../components/ui/sheet";
import { Icon } from "./material-icon";

export function RecordFormSheet({
  open,
  onOpenChange,
  title,
  help,
  headerIcon,
  onSubmit,
  children,
  footer
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  help?: string;
  headerIcon?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="record-sheet" {...(help ? {} : { "aria-describedby": undefined })}>
        <SheetHeader className="record-sheet__header">
          <div className="record-sheet__header-main">
            {headerIcon ? (
              <span className="record-sheet__header-icon" aria-hidden>
                <Icon name={headerIcon} size={22} />
              </span>
            ) : null}
            <div className="record-sheet__header-text">
              <SheetTitle className="pds-type-title-xs-bold record-sheet__title">{title}</SheetTitle>
              {help ? (
                <SheetDescription className="pds-type-body-s-regular record-sheet__help">
                  {help}
                </SheetDescription>
              ) : null}
            </div>
          </div>
        </SheetHeader>
        <form className="entity-form entity-form--sheet record-sheet__form" onSubmit={onSubmit} noValidate>
          <SheetBody className="record-sheet__body">
            <div className="form-stack">{children}</div>
          </SheetBody>
          <SheetFooter className="record-sheet__footer">{footer}</SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
