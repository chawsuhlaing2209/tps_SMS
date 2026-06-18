"use client";

import type { FormEventHandler, ReactNode } from "react";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "../../components/ui/sheet";

export function RecordFormSheet({
  open,
  onOpenChange,
  title,
  help,
  onSubmit,
  children,
  footer
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  help?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {help ? <p className="muted">{help}</p> : null}
        </SheetHeader>
        <form className="entity-form entity-form--sheet" onSubmit={onSubmit} noValidate>
          <SheetBody>
            <div className="form-stack">{children}</div>
          </SheetBody>
          <SheetFooter>{footer}</SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
