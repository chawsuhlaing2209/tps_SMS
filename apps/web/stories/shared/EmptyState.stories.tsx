import { Meta, StoryObj } from "@storybook/react";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/shared/empty-state";

const meta: Meta<typeof EmptyState> = {
  title: "Shared/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    icon: "schedule",
    title: "Empty state title",
    description:
      "A description which can hold up to 1 or 2 lines. Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {};

export const WithAction: Story = {
  args: {
    action: (
      <Button buttonType="filled" buttonColor="secondary" prefixIcon="add">
        Add New
      </Button>
    ),
  },
};

export const Compact: Story = {
  args: { compact: true, embedded: true },
};

export const CompactWithAction: Story = {
  args: {
    compact: true,
    embedded: true,
    action: (
      <Button buttonType="filled" buttonColor="secondary" prefixIcon="add" size="sm">
        Add New
      </Button>
    ),
  },
};

export const Error: Story = {
  args: {
    icon: "error",
    title: "Something went wrong",
    description: "We could not load this list. Try refreshing.",
    compact: true,
    embedded: true,
  },
};
