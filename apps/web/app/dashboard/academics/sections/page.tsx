import { redirect } from "next/navigation";

export default function AcademicsSectionsRedirectPage() {
  redirect("/dashboard/academic-setup/grades-classrooms");
}
