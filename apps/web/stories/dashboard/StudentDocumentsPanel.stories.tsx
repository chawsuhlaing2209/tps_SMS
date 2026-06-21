import { Meta, StoryObj } from "@storybook/react";
import { StudentDocumentsPanel } from "../../app/dashboard/students/student-documents-panel";

const meta: Meta<typeof StudentDocumentsPanel> = {
  title: "Dashboard/StudentDocumentsPanel",
  component: StudentDocumentsPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "padded"
  }
};

export default meta;
type Story = StoryObj<typeof StudentDocumentsPanel>;

export const ViewOnly: Story = {
  args: {
    studentId: "demo-student-id",
    canManage: false
  }
};

export const Manage: Story = {
  args: {
    studentId: "demo-student-id",
    canManage: true
  }
};
