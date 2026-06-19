import { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import { FormField, FormInput } from "../../components/shared/form-input";

const meta: Meta = {
  title: "UI/Sheet",
  tags: ["autodocs"],
};

export default meta;

export const Default: StoryObj = {
  render: function SheetDemo() {
    const [open, setOpen] = useState(false);
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button buttonType="filled" buttonColor="primary" prefixIcon="add">
            Add subject
          </Button>
        </SheetTrigger>
        <SheetContent aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Add subject</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <div style={{ display: "grid", gap: 12 }}>
              <FormField label="Name" htmlFor="subject-name">
                <FormInput id="subject-name" placeholder="Mathematics" />
              </FormField>
              <FormField label="Code" htmlFor="subject-code">
                <FormInput id="subject-code" placeholder="MATH" />
              </FormField>
            </div>
          </SheetBody>
          <SheetFooter>
            <Button buttonType="ghost" buttonColor="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button buttonType="filled" buttonColor="primary" onClick={() => setOpen(false)}>
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  },
};

export const Open: StoryObj = {
  render: () => (
    <Sheet open>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>Edit teacher</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <p className="muted">Sheet body scrolls independently from header and footer.</p>
        </SheetBody>
        <SheetFooter>
          <Button buttonType="filled" buttonColor="primary">
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
  parameters: { layout: "fullscreen" },
};
