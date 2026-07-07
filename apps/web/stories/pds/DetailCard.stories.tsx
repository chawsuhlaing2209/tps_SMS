import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../../components/ui/button";
import { DetailCard } from "../../components/pds/composites/detail-card";
import { pdsShellDecorator } from "./shell-decorator";

const meta: Meta<typeof DetailCard> = {
  title: "PDS/DetailCard",
  component: DetailCard,
  tags: ["autodocs"],
  decorators: [pdsShellDecorator],
};

export default meta;
type Story = StoryObj<typeof DetailCard>;

const teacherTags = [
  { id: "msc", label: "M.Sc Physics — Yangon University" },
  { id: "bed", label: "B.Ed Education" },
  { id: "cert", label: "Cert. Advanced Lab Safety" },
  { id: "dip", label: "Dip. Science Curriculum Design" },
];

const shellActions = (
  <>
    <Button buttonType="outlined" buttonColor="primary" surface="dark" suffixIcon="expand_more">
      More actions
    </Button>
    <Button buttonType="filled" buttonColor="primary" prefixIcon="edit">
      Edit
    </Button>
  </>
);

export const TeacherProfile: Story = {
  args: {
    avatar: { initials: "AK", tone: "teacher" },
    title: "Saya Aung Kyaw Moe",
    status: "Active",
    meta: "Grade 11 Chief · Physics & Chemistry · Physics Department · 6 yrs experience",
    tags: teacherTags,
    actions: shellActions,
  },
};

export const StudentProfile: Story = {
  args: {
    avatar: { initials: "BM", tone: "student" },
    title: "Bhone Myat Min",
    status: "Active",
    meta: "Roll A-1781674443957 · Grade 1 · Room A · Enrolled June 2026",
    actions: (
      <>
        <Button buttonType="outlined" buttonColor="primary" surface="dark" suffixIcon="expand_more">
          More actions
        </Button>
        <Button buttonType="filled" buttonColor="primary" prefixIcon="edit">
          Edit
        </Button>
        <Button buttonType="outlined" buttonColor="primary" surface="dark" prefixIcon="grading">
          Report Card
        </Button>
      </>
    ),
  },
};

export const Minimal: Story = {
  args: {
    avatar: { initials: "AY", tone: "teacher" },
    title: "Academic Year 2025–26",
    meta: "1 Jan 2025 → 31 Dec 2025",
  },
};
