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
  ModalTrigger,
} from "../../components/pds";
import { Button } from "../../components/pds";

const meta: Meta = {
  title: "Legacy/UI Dialog (re-export)",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Re-exports PDS `Modal` from `components/ui/dialog.tsx`. Prefer `PDS/Composites/Modal`.",
      },
    },
  },
};

export default meta;

export const Default: StoryObj = {
  render: function DialogDemo() {
    const [open, setOpen] = useState(false);
    return (
      <Modal open={open} onOpenChange={setOpen}>
        <ModalTrigger asChild>
          <Button buttonType="outlined" buttonColor="primary">
            Open dialog
          </Button>
        </ModalTrigger>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Confirm enrollment</ModalTitle>
            <ModalCloseButton />
          </ModalHeader>
          <ModalBody>
            <ModalDescription>
              Review fees and invoice details before confirming this enrollment.
            </ModalDescription>
          </ModalBody>
          <ModalFooter>
            <ModalFooterStart />
            <ModalFooterActions>
              <Button buttonType="ghost" buttonColor="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button buttonType="filled" buttonColor="primary" onClick={() => setOpen(false)}>
                Confirm
              </Button>
            </ModalFooterActions>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  },
  parameters: { layout: "centered" },
};
