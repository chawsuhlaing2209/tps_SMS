import type { Meta, StoryObj } from "@storybook/react";
import { IconTile } from "../../components/pds/subcomponents/icon-tile";
import { pdsCanvasDecorator } from "./decorators";

const meta: Meta<typeof IconTile> = {
  title: "PDS/IconTile",
  component: IconTile,
  tags: ["autodocs"],
  decorators: [pdsCanvasDecorator],
};

export default meta;
type Story = StoryObj<typeof IconTile>;

export const Tones: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12 }}>
      <IconTile icon="groups" tone="blue" />
      <IconTile icon="payments" tone="green" />
      <IconTile icon="event_busy" tone="orange" />
      <IconTile icon="warning" tone="red" />
      <IconTile icon="workspace_premium" tone="purple" />
    </div>
  ),
};
