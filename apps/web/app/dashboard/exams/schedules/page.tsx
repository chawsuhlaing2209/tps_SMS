"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DataTable } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { hasAnyPermission } from "../../../lib/permissions";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { getSession } from "../../../lib/session";
import { TablePanelBody, TablePanelHead } from "../../../lib/table-panel";
import { zodResolver } from "../../../lib/zod-resolver";

type ExamCycle = { id: string; name: string };
type Classroom = { id: string; name: string };
type Subject = { id: string; name: string };
type ClassroomStudent = { id: string; fullName: string };
type ExamSchedule = {
  id: string;
  examCycleId: string;
  classroomId: string;
  subjectId: string;
  examDate: string;
  fullMarks: string;
  updatedAt?: string;
};

type ScheduleValues = {
  examCycleId: string;
  classroomId: string;
  subjectId: string;
  examDate: string;
  maxMarks: string;
};

const SCHEDULES_PATH = (tenant: string) => `/tenants/${tenant}/exam-schedules`;

export default function ExamSchedulesPage() {
  const t = useTranslations("exams");
  const c = useTranslations("common");
  const requiredMessage = c("required");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["exam.manage"]);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [resultsSchedule, setResultsSchedule] = useState<ExamSchedule | null>(null);
  const [results, setResults] = useState<Record<string, { marks: string; remarks: string }>>({});
  const [classroomFilter, setClassroomFilter] = useState("");

  const cycles = useApiQuery<ExamCycle[]>((tn) => (canManage ? `/tenants/${tn}/exam-cycles` : null));
  const classrooms = useApiQuery<Classroom[]>((tn) => `/tenants/${tn}/classrooms`);
  const subjects = useApiQuery<Subject[]>((tn) => `/tenants/${tn}/academics/subjects`);

  const schedulesQuery = useMemo(
    () => (classroomFilter ? `?classroomId=${classroomFilter}` : ""),
    [classroomFilter]
  );
  const schedules = useApiQuery<ExamSchedule[]>((tn) =>
    canManage ? `${SCHEDULES_PATH(tn)}${schedulesQuery}` : null
  );

  const classroomStudents = useApiQuery<ClassroomStudent[]>((tn) =>
    resultsSchedule ? `/tenants/${tn}/classrooms/${resultsSchedule.classroomId}/students` : null
  );

  const cycleName = (id: string) => cycles.data?.find((x) => x.id === id)?.name ?? id;
  const classroomName = (id: string) => classrooms.data?.find((x) => x.id === id)?.name ?? id;
  const subjectName = (id: string) => subjects.data?.find((x) => x.id === id)?.name ?? id;

  const create = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: SCHEDULES_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `${SCHEDULES_PATH(tenant)}${schedulesQuery}`,
        SCHEDULES_PATH(tenant)
      ]
    }
  );

  const saveResults = useApiMutation<{ scheduleId: string; body: Record<string, unknown> }>(
    ({ scheduleId, body }, tenant) => ({
      path: `${SCHEDULES_PATH(tenant)}/${scheduleId}/results`,
      init: { method: "POST", body: JSON.stringify(body) }
    })
  );

  const lock = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${SCHEDULES_PATH(tenant)}/${id}/lock`,
      init: { method: "POST", body: JSON.stringify({}) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `${SCHEDULES_PATH(tenant)}${schedulesQuery}`,
        SCHEDULES_PATH(tenant)
      ]
    }
  );

  const schema = useMemo(
    () =>
      z.object({
        examCycleId: z.string().uuid(requiredMessage),
        classroomId: z.string().uuid(requiredMessage),
        subjectId: z.string().uuid(requiredMessage),
        examDate: z.string().trim().min(1, requiredMessage),
        maxMarks: z.string().trim().min(1, requiredMessage)
      }),
    [requiredMessage]
  );

  const form = useForm<ScheduleValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      examCycleId: "",
      classroomId: "",
      subjectId: "",
      examDate: "",
      maxMarks: "100"
    }
  });

  const openResults = (schedule: ExamSchedule) => {
    setResults({});
    setResultsSchedule(schedule);
  };

  const columns: ColumnDef<ExamSchedule, unknown>[] = [
    { id: "cycle", header: t("cycle"), accessorFn: (row) => cycleName(row.examCycleId) },
    { id: "classroom", header: t("classroom"), accessorFn: (row) => classroomName(row.classroomId) },
    { id: "subject", header: t("subject"), accessorFn: (row) => subjectName(row.subjectId) },
    { id: "date", header: t("examDate"), accessorKey: "examDate" },
    { id: "maxMarks", header: t("maxMarks"), accessorKey: "fullMarks" },
    {
      id: "actions",
      header: t("actions"),
      enableSorting: false,
      cell: ({ row }) => (
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" className="row-action" onClick={() => openResults(row.original)}>
            {t("enterResults")}
          </button>
          <button
            type="button"
            className="row-action"
            disabled={lock.isPending}
            onClick={() => void lock.mutateAsync({ id: row.original.id })}
          >
            {lock.isPending ? t("locking") : t("lock")}
          </button>
        </div>
      )
    }
  ];

  if (!canManage) {
    return <p className="muted">{c("empty")}</p>;
  }

  return (
    <>
      <TablePanelHead
        title={t("schedulesTitle")}
        extra={
          <label className="form-inline">
            <span className="muted">{t("filterClassroom")}</span>
            <select value={classroomFilter} onChange={(e) => setClassroomFilter(e.target.value)}>
              <option value="">{t("allClassrooms")}</option>
              {classrooms.data?.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name}
                </option>
              ))}
            </select>
          </label>
        }
        onRefresh={() => void schedules.refetch()}
        onAdd={() => {
          form.reset({
            examCycleId: "",
            classroomId: "",
            subjectId: "",
            examDate: "",
            maxMarks: "100"
          });
          setScheduleOpen(true);
        }}
        addLabel={t("addSchedule")}
      />
      <TablePanelBody
        loading={schedules.isLoading}
        error={schedules.isError ? c("somethingWrong") : null}
        empty={!schedules.data?.length}
      >
        <DataTable columns={columns} data={schedules.data ?? []} />
      </TablePanelBody>

      <RecordFormSheet
        open={scheduleOpen}
        onOpenChange={(open) => {
          setScheduleOpen(open);
          if (!open) form.reset();
        }}
        title={t("addScheduleTitle")}
        onSubmit={form.handleSubmit(async (values) => {
          await create.mutateAsync({
            examCycleId: values.examCycleId,
            classroomId: values.classroomId,
            subjectId: values.subjectId,
            examDate: values.examDate,
            maxMarks: Number(values.maxMarks)
          });
          setScheduleOpen(false);
          form.reset();
        })}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setScheduleOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
              <Icon name="check" />
              {form.formState.isSubmitting ? t("creating") : c("save")}
            </button>
          </>
        }
      >
        <Field label={t("cycle")} error={form.formState.errors.examCycleId?.message}>
          <select {...form.register("examCycleId")}>
            <option value="">{t("selectCycle")}</option>
            {cycles.data?.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("classroom")} error={form.formState.errors.classroomId?.message}>
          <select {...form.register("classroomId")}>
            <option value="">{t("selectClassroom")}</option>
            {classrooms.data?.map((cl) => (
              <option key={cl.id} value={cl.id}>
                {cl.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("subject")} error={form.formState.errors.subjectId?.message}>
          <select {...form.register("subjectId")}>
            <option value="">{t("selectSubject")}</option>
            {subjects.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("examDate")} error={form.formState.errors.examDate?.message}>
          <input type="date" {...form.register("examDate")} />
        </Field>
        <Field label={t("maxMarks")} error={form.formState.errors.maxMarks?.message}>
          <input type="number" min={0} {...form.register("maxMarks")} />
        </Field>
      </RecordFormSheet>

      <RecordFormSheet
        open={resultsSchedule !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResultsSchedule(null);
            setResults({});
          }
        }}
        title={t("enterResultsTitle")}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!resultsSchedule) return;
          const entries = Object.entries(results)
            .filter(([, v]) => v.marks !== "" || v.remarks !== "")
            .map(([studentId, v]) => ({
              studentId,
              marksObtained: v.marks !== "" ? Number(v.marks) : undefined,
              remarks: v.remarks || undefined
            }));
          if (entries.length === 0) return;
          await saveResults.mutateAsync({
            scheduleId: resultsSchedule.id,
            body: { results: entries }
          });
          setResultsSchedule(null);
          setResults({});
        }}
        footer={
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setResultsSchedule(null);
                setResults({});
              }}
            >
              {c("cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={saveResults.isPending}>
              <Icon name="check" />
              {saveResults.isPending ? t("savingResults") : t("saveResults")}
            </button>
          </>
        }
      >
        {classroomStudents.isLoading ? (
          <p className="muted">{c("loading")}</p>
        ) : !classroomStudents.data?.length ? (
          <p className="muted">{t("noStudents")}</p>
        ) : (
          <div className="form-stack">
            {classroomStudents.data.map((student) => {
              const value = results[student.id] ?? { marks: "", remarks: "" };
              return (
                <div key={student.id} style={{ display: "grid", gap: "6px" }}>
                  <strong>{student.fullName}</strong>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="number"
                      min={0}
                      placeholder={t("marks")}
                      value={value.marks}
                      onChange={(e) =>
                        setResults((prev) => ({
                          ...prev,
                          [student.id]: { ...value, marks: e.target.value }
                        }))
                      }
                    />
                    <input
                      type="text"
                      placeholder={t("remarks")}
                      value={value.remarks}
                      onChange={(e) =>
                        setResults((prev) => ({
                          ...prev,
                          [student.id]: { ...value, remarks: e.target.value }
                        }))
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </RecordFormSheet>
    </>
  );
}