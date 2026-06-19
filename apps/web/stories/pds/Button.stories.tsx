import { Meta, StoryObj } from "@storybook/react";
import { Button } from "../../components/ui/button";

const meta: Meta<typeof Button> = {
  title: "PDS/Subcomponents/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Button",
    buttonType: "filled",
    buttonColor: "primary",
  },
  argTypes: {
    buttonType: { control: "select", options: ["filled", "outlined", "ghost"] },
    buttonColor: { control: "select", options: ["primary", "secondary"] },
    surface: { control: "select", options: ["light", "dark"] },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const FilledPrimary: Story = {};
export const FilledSecondary: Story = { args: { buttonColor: "secondary" } };
export const OutlinedPrimaryOnLight: Story = {
  args: { buttonType: "outlined", buttonColor: "primary" },
};
export const OutlinedPrimaryOnDark: Story = {
  args: { buttonType: "outlined", surface: "dark" },
  parameters: { backgrounds: { default: "dark" } },
};
export const OutlinedSecondaryOnLight: Story = {
  args: { buttonType: "outlined", buttonColor: "secondary" },
};
export const GhostPrimary: Story = { args: { buttonType: "ghost" } };
export const GhostSecondaryOnDarkDisabled: Story = {
  args: { buttonType: "ghost", buttonColor: "secondary", surface: "dark", disabled: true },
  parameters: { backgrounds: { default: "dark" } },
};
export const HoverStates: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      <Button buttonType="filled" buttonColor="primary">
        Filled primary
      </Button>
      <Button buttonType="filled" buttonColor="secondary">
        Filled secondary
      </Button>
      <Button buttonType="outlined" buttonColor="primary">
        Outlined primary
      </Button>
      <Button buttonType="outlined" buttonColor="secondary">
        Outlined secondary
      </Button>
      <Button buttonType="ghost" buttonColor="primary">
        Ghost primary
      </Button>
    </div>
  ),
  parameters: { docs: { description: { story: "Hover each button to preview interactive states." } } },
};
export const WithIcons: Story = {
  args: { prefixIcon: "edit", suffixIcon: "expand_more", buttonType: "outlined", buttonColor: "primary", surface: "dark" },
  parameters: { backgrounds: { default: "dark" } },
};
export const OnDarkOutlined: Story = {
  args: { buttonType: "outlined", buttonColor: "primary", surface: "dark", suffixIcon: "expand_more", children: "More actions" },
  parameters: { backgrounds: { default: "dark" } },
};
export const OnDarkFilled: Story = {
  args: { buttonType: "filled", buttonColor: "primary", prefixIcon: "edit", children: "Edit" },
  parameters: { backgrounds: { default: "dark" } },
};
export const Disabled: Story = { args: { disabled: true } };
