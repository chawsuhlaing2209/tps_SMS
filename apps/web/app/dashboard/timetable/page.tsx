import dynamic from "next/dynamic";
import { WorkspaceLoading } from "../../lib/workspace-loading";

const TimetableWorkspace = dynamic(
  () => import("./timetable-workspace").then((module) => module.TimetableWorkspace),
  { loading: () => <WorkspaceLoading /> }
);

export default function TimetablePage() {
  return <TimetableWorkspace />;
}
