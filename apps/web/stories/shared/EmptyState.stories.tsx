import { Meta, StoryObj } from "@storybook/react";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/shared/empty-state";

const meta: Meta<typeof EmptyState> = {
  title: "Shared/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/ijAgEelM6OgifzPI0R5BoQ/Pujuba?node-id=54-2584",
    },
  },
  args: {
    icon: "schedule",
    title: "No rooms yet for this grade.",
    description:
      "A description which can hold up to 1 or 2 lines. Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

/** Figma `type=comfort` (54:2585) — default spacing, filled secondary CTA. */
export const Comfort: Story = {
  args: {
    action: (
      <Button buttonType="filled" buttonColor="secondary" prefixIcon="add">
        Add New
      </Button>
    ),
  },
};

/** Figma `type=compact` (118:9666) — tighter gap, outlined CTA. */
export const Compact: Story = {
  args: {
    compact: true,
    action: (
      <Button buttonType="outlined" buttonColor="secondary" prefixIcon="add" size="sm">
        Add New
      </Button>
    ),
  },
};

export const CompactEmbeddedInTableCard: Story = {
  name: "Compact / embedded in table card",
  args: {
    compact: true,
    embedded: true,
  },
  decorators: [
    (Story) => (
      <section className="table-card">
        <div className="table-card__body">
          <Story />
        </div>
      </section>
    ),
  ],
};

export const Error: Story = {
  args: {
    icon: "error",
    title: "Something went wrong",
    description: "We could not load this list. Try refreshing.",
    compact: true,
    embedded: true,
  },
  decorators: [
    (Story) => (
      <section className="table-card">
        <div className="table-card__body">
          <Story />
        </div>
      </section>
    ),
  ],
};
