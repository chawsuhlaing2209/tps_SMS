import type { Meta, StoryObj } from "@storybook/react";
import { EntityList, EntityListItem } from "../../components/pds/composites/entity-list";
import { pdsCanvasDecorator } from "./decorators";

const meta: Meta<typeof EntityListItem> = {
  title: "PDS/EntityList",
  component: EntityListItem,
  tags: ["autodocs"],
  decorators: [pdsCanvasDecorator],
  parameters: {
    docs: {
      description: {
        component:
          "Card rows with squircle avatar, stacked title + meta, and optional trailing action. Always wrap items in `EntityList` for vertical spacing.",
      },
    },
  },
  args: {
    title: "Maths",
    meta: "Daw Khin Mar Oo · 6 periods / week",
    nameForColor: "Maths",
    actionLabel: "Open >",
    href: "#maths",
  },
  render: (args) => (
    <EntityList>
      <EntityListItem {...args} />
    </EntityList>
  ),
};

export default meta;
type Story = StoryObj<typeof EntityListItem>;

export const SubjectRow: Story = {
  render: () => (
    <EntityList>
      <EntityListItem
        title="Maths"
        meta="Daw Khin Mar Oo · 6 periods / week"
        nameForColor="Maths"
        actionLabel="Open >"
        href="#maths"
      />
      <EntityListItem
        title="English"
        meta="U Aung Kyaw · 5 periods / week"
        nameForColor="English"
        actionLabel="Open >"
        href="#english"
      />
      <EntityListItem
        title="Physics"
        meta="No teacher assigned"
        nameForColor="Physics"
        actionLabel="Open >"
        href="#physics"
      />
    </EntityList>
  ),
};

export const StudentRoster: Story = {
  render: () => (
    <EntityList>
      <EntityListItem
        title="Ma Ei Mon"
        meta="BILL-G12-10"
        initials="ME"
        nameForColor="Ma Ei Mon"
        href="#student-1"
      />
      <EntityListItem
        title="Ma Su Mon"
        meta="BILL-G12-11"
        initials="MS"
        nameForColor="Ma Su Mon"
        href="#student-2"
      />
    </EntityList>
  ),
};
