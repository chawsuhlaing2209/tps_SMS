import { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
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
import { Button } from "../../components/ui/button";
import { ConfirmDialog, AppModal } from "../../components/shared/confirm-dialog";
import { FormField, FormInput } from "../../components/shared/form-input";

const meta: Meta = {
  title: "PDS/Composites/Modal",
  tags: ["autodocs"],
};

export default meta;

export const Confirmation: StoryObj = {
  render: function ConfirmationModal() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button buttonType="outlined" buttonColor="secondary" onClick={() => setOpen(true)}>
          Open modal
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Archive this student?"
          description="They will no longer appear in active lists. You can restore them later."
          confirmLabel="Archive"
          cancelLabel="Cancel"
          onConfirm={() => setOpen(false)}
        />
      </>
    );
  },
  parameters: { layout: "centered" },
};

export const WithFormBody: StoryObj = {
  render: function FormModal() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button buttonType="outlined" buttonColor="secondary" onClick={() => setOpen(true)}>
          Open modal
        </Button>
        <AppModal
          open={open}
          onOpenChange={setOpen}
          title="Add subject"
          description="Create a subject and map it to grade levels."
          footer={
            <>
              <Button buttonType="outlined" buttonColor="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button buttonType="filled" buttonColor="primary" onClick={() => setOpen(false)}>
                Submit
              </Button>
            </>
          }
        >
          <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
            <FormField label="Subject name">
              <FormInput placeholder="Mathematics" />
            </FormField>
            <FormField label="Code">
              <FormInput placeholder="MATH" />
            </FormField>
          </div>
        </AppModal>
      </>
    );
  },
  parameters: { layout: "centered" },
};

export const PrimitiveSlots: StoryObj = {
  render: function PrimitiveSlotsModal() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button buttonType="outlined" buttonColor="secondary" onClick={() => setOpen(true)}>
          Open modal
        </Button>
        <Modal open={open} onOpenChange={setOpen}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Title</ModalTitle>
              <ModalCloseButton />
            </ModalHeader>
            <ModalBody>
              <ModalDescription>
                A description which can hold up to 2 or 3 lines. Use the body slot for forms,
                invoices, lists, or any custom content.
              </ModalDescription>
            </ModalBody>
            <ModalFooter>
              <ModalFooterStart />
              <ModalFooterActions>
                <Button buttonType="outlined" buttonColor="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button buttonType="filled" buttonColor="primary" onClick={() => setOpen(false)}>
                  Submit
                </Button>
              </ModalFooterActions>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </>
    );
  },
  parameters: { layout: "centered" },
};
