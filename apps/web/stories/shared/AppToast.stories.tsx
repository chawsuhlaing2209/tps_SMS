import { Meta, StoryObj } from "@storybook/react";
import { toast } from "sonner";
import { AppToast } from "../../components/shared/app-toast";
import { AppToaster } from "../../components/shared/app-toaster";
import { Button } from "../../components/ui/button";

const meta: Meta<typeof AppToast> = {
  title: "Shared/AppToast",
  component: AppToast,
  tags: ["autodocs"],
  args: {
    variant: "success",
    message: "Enrollment saved successfully.",
    onClose: () => undefined,
  },
  decorators: [
    (Story) => (
      <>
        <Story />
        <AppToaster />
      </>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AppToast>;

export const Success: Story = {
  args: { variant: "success", message: "Payment recorded." },
};

export const Error: Story = {
  args: { variant: "error", message: "Could not save changes. Try again." },
};

export const LiveDemo: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12 }}>
      <Button
        buttonType="filled"
        buttonColor="primary"
        onClick={() =>
          toast.custom((id) => (
            <AppToast
              variant="success"
              message="Saved successfully."
              onClose={() => toast.dismiss(id)}
            />
          ))
        }
      >
        Show success
      </Button>
      <Button
        buttonType="outlined"
        buttonColor="secondary"
        onClick={() =>
          toast.custom((id) => (
            <AppToast
              variant="error"
              message="Something went wrong."
              onClose={() => toast.dismiss(id)}
            />
          ))
        }
      >
        Show error
      </Button>
    </div>
  ),
};
