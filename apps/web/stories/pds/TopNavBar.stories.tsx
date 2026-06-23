import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "../../app/lib/material-icon";
import { LanguageSwitcher } from "../../app/lib/language-switcher";
import { TopNavBar } from "../../components/pds/composites/top-nav-bar";
import { WorkingYearBadge } from "../../app/dashboard/working-year-badge";
import { pdsCanvasDecorator } from "./decorators";

const meta: Meta<typeof TopNavBar> = {
  title: "PDS/TopNavBar",
  component: TopNavBar,
  tags: ["autodocs"],
  decorators: [pdsCanvasDecorator],
};

export default meta;
type Story = StoryObj<typeof TopNavBar>;

/** Figma 119:9730 — breadcrumb + locale + academic year + notifications. */
export const DashboardChrome: Story = {
  render: () => (
    <TopNavBar
      breadcrumbItems={[
        { label: "Students directory", href: "/dashboard/people?tab=students" },
        { label: "Students" },
      ]}
      utilities={
        <>
          <LanguageSwitcher variant="segmented" />
          <WorkingYearBadge variant="topNav" />
          <button type="button" className="pds-top-nav-bar__notifications" aria-label="Notifications">
            <Icon name="notifications" size={20} />
            <span className="pds-top-nav-bar__notifications-dot" aria-hidden />
          </button>
        </>
      }
    />
  ),
};

export const BreadcrumbOnly: Story = {
  args: {
    breadcrumbItems: [{ label: "Finance", href: "/dashboard/finance" }, { label: "Payments" }],
  },
};
