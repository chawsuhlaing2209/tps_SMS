import type { Meta, StoryObj } from "@storybook/react";
import { InfoCard } from "../../components/pds/composites/info-card";
import { pdsCanvasDecorator } from "./decorators";

const meta: Meta<typeof InfoCard> = {
  title: "PDS/InfoCard",
  component: InfoCard,
  tags: ["autodocs"],
  decorators: [pdsCanvasDecorator],
};

export default meta;
type Story = StoryObj<typeof InfoCard>;

export const GlobalRule: Story = {
  render: () => (
    <div style={{ maxWidth: "34.5rem" }}>
      <InfoCard
        badge="Global rule"
        title="First match wins"
        description="When several discounts apply, only the highest-priority rule is used. Dark feature card."
      />
    </div>
  ),
};

export const WithoutBadge: Story = {
  render: () => (
    <div style={{ maxWidth: "34.5rem" }}>
      <InfoCard
        title="Sibling discount"
        description="Applied automatically when enrolling a second child from the same household."
      />
    </div>
  ),
};
