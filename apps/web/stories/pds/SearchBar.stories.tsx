import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { PdsSearchBar } from "../../components/pds/composites/search-bar";
import { PdsSearchFiltersRow } from "../../components/pds/composites/search-filters-row";
import { SegmentedControl } from "../../components/pds/composites/segmented-control";

const meta: Meta<typeof PdsSearchBar> = {
  title: "PDS/SearchBar",
  component: PdsSearchBar,
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj<typeof PdsSearchBar>;

export const Default: Story = {
  render: () => (
    <PdsSearchBar
      placeholder="Search by invoice no., student or guardian…"
      aria-label="Search invoices"
    />
  ),
};

export const InFiltersRow: Story = {
  render: function InFiltersRowStory() {
    const [status, setStatus] = useState("");
    return (
      <PdsSearchFiltersRow
        filters={
          <PdsSearchBar
            placeholder="Search by invoice no., student or guardian…"
            aria-label="Search invoices"
          />
        }
        statusControl={
          <SegmentedControl
            ariaLabel="Status"
            value={status}
            onChange={setStatus}
            options={[
              { id: "", label: "All" },
              { id: "paid", label: "Paid" },
              { id: "partial", label: "Partial" },
              { id: "due", label: "Due" },
              { id: "overdue", label: "Overdue" },
            ]}
          />
        }
      />
    );
  },
};
