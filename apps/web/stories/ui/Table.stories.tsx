import { Meta, StoryObj } from "@storybook/react";
import { Badge } from "../../components/shared/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";

const meta: Meta = {
  title: "UI/Table",
  tags: ["autodocs"],
};

export default meta;

export const PadaukTable: StoryObj = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Student</TableHead>
          <TableHead>Grade</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="padauk-table__num">Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Maung Maung</TableCell>
          <TableCell className="padauk-table__muted">Grade 4 · A</TableCell>
          <TableCell>
            <Badge tone="success">Enrolled</Badge>
          </TableCell>
          <TableCell className="padauk-table__num">125,000</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Thiri Thiri</TableCell>
          <TableCell className="padauk-table__muted">Grade 2 · B</TableCell>
          <TableCell>
            <Badge tone="warning">Pending</Badge>
          </TableCell>
          <TableCell className="padauk-table__num">0</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
  parameters: { layout: "padded" },
};
