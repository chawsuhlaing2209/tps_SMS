"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiQuery } from "../../../../../../../../lib/api";
import { StudentCombobox } from "../../../../../../../../lib/student-combobox";
import { DataTable } from "../../../../../../../../lib/data-table";
import { Field } from "../../../../../../../../lib/form";
import { Icon } from "../../../../../../../../lib/material-icon";
import { RecordFormSheet } from "../../../../../../../../lib/record-sheet";
import { TablePanelBody, TablePanelHead } from "../../../../../../../../lib/table-panel";
import { zodResolver } from "../../../../../../../../lib/zod-resolver";
import { PageHeader } from "../../../../../../../page-header-context";

type AcademicYear = { id: string; name: string };
type Grade = { id: string; name: string };
type Classroom = { id: string; name: string };
type ClassroomStudent = {
  id: string;
  fullName: string;
  admissionNumber: string;
  status: string;
};
type StudentOption = { id: string; fullName: string; admissionNumber: string };

const studentsPath = (tenant: string, classroomId: string) =>
  `/tenants/${tenant}/classrooms/${classroomId}/students`;

export default function ClassroomStudentsPage() {
  const params = useParams<{ yearId: string; gradeId: string; classroomId: string }>();
  const router = useRouter();
  const { yearId, gradeId, classroomId } = params;
  const t = useTranslations("academics");
  const c = useTranslations("common");
  const [assignOpen, setAssignOpen] = useState(false);

  const years = useApiQuery<AcademicYear[]>((tn) => `/tenants/${tn}/academics/setup/academic-years`);
  const grades = useApiQuery<Grade[]>((tn) => `/tenants/${tn}/academics/grades`);
  const classroom = useApiQuery<Classroom>((tn) => `/tenants/${tn}/classrooms/${classroomId}`);
  const students = useApiQuery<ClassroomStudent[]>((tn) => studentsPath(tn, classroomId));

  const schema = z.object({
    studentId: z.string().uuid(c("required"))
  });

  const form = useForm<{ studentId: string }>({
    resolver: zodResolver(schema),
    defaultValues: { studentId: "" }
  });

  const yearRecord = years.data?.find((row) => row.id === yearId);
  const gradeRecord = grades.data?.find((row) => row.id === gradeId);
  const enrolledIds = new Set(students.data?.map((student) => student.id) ?? []);

  const columns: ColumnDef<ClassroomStudent, unknown>[] = [
    { id: "name", header: t("student"), accessorKey: "fullName" },
    {
      id: "overallGrade",
      header: t("overallGrade"),
      accessorFn: () => "—"
    },
    {
      id: "actions",
      header: t("actions"),
      enableSorting: false,
      cell: ({ row }) => (
        <div style={{ display: "flex", gap: "8px" }}>
          <Link href={`/dashboard/students/${row.original.id}`} className="row-action">
            {t("viewProfile")}
          </Link>
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        title={classroom.data?.name ?? t("classroom")}
        breadcrumbs={[
          { label: t("years"), href: "/dashboard/academic-setup/years" },
          {
            label: gradeRecord?.name ?? t("grade"),
            href: `/dashboard/academic-setup/grades-classrooms?grade=${gradeId}`
          },
          { label: classroom.data?.name ?? t("classroom") }
        ]}
      />

      <section className="panel">
        <TablePanelHead
          title={t("students")}
          onRefresh={() => void students.refetch()}
          onAdd={() => {
            form.reset({ studentId: "" });
            setAssignOpen(true);
          }}
          addLabel={t("assignStudent")}
          extra={
            <Link href={`/dashboard/structure/rooms/${classroomId}`} className="btn-ghost">
              {t("openClassroom")}
            </Link>
          }
        />
        <p className="muted panel-help">{t("classroomRosterSetupHelp")}</p>
        <TablePanelBody
          loading={students.isLoading || classroom.isLoading}
          error={students.isError ? c("somethingWrong") : null}
          empty={!students.data?.length}
        >
          <DataTable
            columns={columns}
            data={students.data ?? []}
            getRowHref={(student) => `/dashboard/students/${student.id}`}
          />
        </TablePanelBody>

        <RecordFormSheet
          open={assignOpen}
          onOpenChange={(open) => {
            if (!open) {
              setAssignOpen(false);
              form.reset({ studentId: "" });
            }
          }}
          title={t("assignStudent")}
          onSubmit={form.handleSubmit(async (values) => {
            setAssignOpen(false);
            form.reset({ studentId: "" });
            router.push(
              `/dashboard/finance/billing?studentId=${values.studentId}&classroomId=${classroomId}`
            );
          })}
          footer={
            <>
              <button type="button" className="btn-ghost" onClick={() => setAssignOpen(false)}>
                {c("cancel")}
              </button>
              <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
                <Icon name="person_add" />
                {form.formState.isSubmitting ? t("creating") : t("assignStudent")}
              </button>
            </>
          }
        >
          <Field label={t("student")} error={form.formState.errors.studentId?.message}>
            <StudentCombobox
              value={form.watch("studentId")}
              onChange={(studentId) =>
                form.setValue("studentId", studentId, { shouldValidate: true })
              }
              excludeIds={[...enrolledIds]}
            />
          </Field>
        </RecordFormSheet>
      </section>
    </>
  );
}