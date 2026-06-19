import { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ConfirmDialog } from "../../components/shared/confirm-dialog";
import { Button } from "../../components/ui/button";

const meta: Meta<typeof ConfirmDialog> = {
  title: "Shared/ConfirmDialog",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Thin confirmation preset over `PDS/Composites/Modal`. For custom bodies use `AppModal` or compose `Modal*` primitives directly.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ConfirmDialog>;

export const Interactive: Story = {
  render: function ConfirmDialogDemo() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    return (
      <>
        <Button buttonType="outlined" buttonColor="secondary" onClick={() => setOpen(true)}>
          Open confirm dialog
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Archive this student?"
          description="They will no longer appear in active lists."
          confirmLabel="Archive"
          destructive
          loading={loading}
          onConfirm={() => {
            setLoading(true);
            window.setTimeout(() => {
              setLoading(false);
              setOpen(false);
            }, 800);
          }}
        />
      </>
    );
  },
  parameters: { layout: "centered" },
};
