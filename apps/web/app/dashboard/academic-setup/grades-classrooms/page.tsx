"use client";
import { FormInput } from "../../../../components/shared/form-input";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CheckboxList, PdsSelectField } from "../../../../components/pds";
import { EmptyState } from "../../../../components/shared/empty-state";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { zodResolver } from "../../../lib/zod-resolver";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { PageHeader } from "../../page-header-context";
import { gradeStreamLabel } from "../grade-label";
import {
  ClassroomFormSheet,
  type ClassroomFormValues
} from "../../structure/classroom-form-sheet";
import { roomLetter, subjectColor, subjectIcon } from "../../structure/subject-colors";
import { useAcademicYearContext } from "../use-academic-year-context";

type Subject = { id: string; name: string; status: string };
type GradeOverview = {
  id: string;
  name: string;
  minAge: number | null;
  maxAge: number | null;
  status: string;
  subjectCount: number;
  subjects: { id: string; name: string; code: string | null }[];
  classroomCount: number;
  studentCount: number;
  gradeChiefName: string | null;
  gradeChiefStaffId: string | null;
};
type ClassroomOverview = {
  id: string;
  name: string;
  room: string | null;
  capacity: number | null;
  studentCount: number;
  classTeacherName: string | null;
  classTeacherStaffId: string | null;
  status: string;
};
type StaffMember = { id: string; fullName: string };

type GradeFormValues = {
  name: string;
  minAge: string;
  maxAge: string;
  subjectIds: string[];
  gradeChiefStaffId: string;
  roomName: string;
  roomCapacity: string;
};

type GradeFormMode = { type: "create" } | { type: "edit"; grade: GradeOverview };
type RoomFormMode =
  | { type: "create" }
  | { type: "edit"; room: ClassroomOverview };

const setupGradesPath = (tenant: string, yearId: string) =>
  `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades`;
const setupYearsPath = (tenant: string) => `/tenants/${tenant}/academics/setup/academic-years`;
const setupClassroomsPath = (tenant: string, yearId: string, gradeId: string) =>
  `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades/${gradeId}/classrooms`;
const CLASSROOMS_PATH = (tenant: string) => `/tenants/${tenant}/classrooms`;
const GRADES_PATH = (tenant: string) => `/tenants/${tenant}/academics/grades`;

function invalidatePaths(tenant: string, yearId: string, gradeId?: string) {
  const paths = [
    GRADES_PATH(tenant),
    setupGradesPath(tenant, yearId),
    setupYearsPath(tenant),
    CLASSROOMS_PATH(tenant)
  ];
  if (gradeId) {
    paths.push(setupClassroomsPath(tenant, yearId, gradeId));
  }
  return paths;
}

export default function GradesClassroomsPage() {
  const t = useTranslations("academics");
  const setup = useTranslations("academicSetup");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const requiredMessage = c("required");

  const currentYear = useCurrentAcademicYear();
  const { contextYearId } = useAcademicYearContext(currentYear.data);
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
  const [gradeFormMode, setGradeFormMode] = useState<GradeFormMode | null>(null);
  const [roomFormMode, setRoomFormMode] = useState<RoomFormMode | null>(null);

  const grades = useApiQuery<GradeOverview[]>((tn) =>
    contextYearId ? setupGradesPath(tn, contextYearId) : null
  );
  const subjects = useApiQuery<Subject[]>((tn) => `/tenants/${tn}/academics/subjects`);
  const teachers = useApiQuery<StaffMember[]>(
    (tn) => `/tenants/${tn}/hr/staff?employmentRole=teacher`
  );

  const activeGrades = useMemo(
    () => (grades.data ?? []).filter((grade) => grade.status !== "archived"),
    [grades.data]
  );

  useEffect(() => {
    if (!activeGrades.length) {
      setSelectedGradeId(null);
      return;
    }
    const fromUrl = searchParams.get("grade");
    if (fromUrl && activeGrades.some((g) => g.id === fromUrl)) {
      setSelectedGradeId(fromUrl);
      return;
    }
    if (!selectedGradeId || !activeGrades.some((g) => g.id === selectedGradeId)) {
      setSelectedGradeId(activeGrades[0]!.id);
    }
  }, [activeGrades, searchParams, selectedGradeId]);

  const selectGrade = (gradeId: string) => {
    setSelectedGradeId(gradeId);
    router.replace(`/dashboard/academic-setup/grades-classrooms?grade=${gradeId}`);
  };

  const selectedGrade = activeGrades.find((g) => g.id === selectedGradeId) ?? null;

  const classrooms = useApiQuery<ClassroomOverview[]>(
    (tn) =>
      contextYearId && selectedGradeId
        ? setupClassroomsPath(tn, contextYearId, selectedGradeId)
        : null
  );

  const createGrade = useApiMutation<Record<string, unknown>, { id: string }>(
    (body, tenant) => ({
      path: GRADES_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) =>
        contextYearId ? invalidatePaths(tenant, contextYearId) : [GRADES_PATH(tenant)]
    }
  );

  const updateGrade = useApiMutation<{ id: string } & Record<string, unknown>>(
    (body, tenant) => {
      const { id, ...payload } = body;
      return {
        path: `${GRADES_PATH(tenant)}/${id}`,
        init: { method: "PATCH", body: JSON.stringify(payload) }
      };
    },
    {
      invalidatePaths: (_b, tenant) =>
        contextYearId ? invalidatePaths(tenant, contextYearId) : [GRADES_PATH(tenant)]
    }
  );

  const createRoom = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: CLASSROOMS_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) =>
        contextYearId && selectedGradeId
          ? invalidatePaths(tenant, contextYearId, selectedGradeId)
          : []
    }
  );

  const updateRoom = useApiMutation<{ id: string } & Record<string, unknown>>(
    (body, tenant) => {
      const { id, ...payload } = body;
      return {
        path: `${CLASSROOMS_PATH(tenant)}/${id}`,
        init: { method: "PATCH", body: JSON.stringify(payload) }
      };
    },
    {
      invalidatePaths: (_b, tenant) =>
        contextYearId && selectedGradeId
          ? invalidatePaths(tenant, contextYearId, selectedGradeId)
          : []
    }
  );

  const gradeSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, requiredMessage),
        minAge: z.string(),
        maxAge: z.string(),
        subjectIds: z.array(z.string()),
        gradeChiefStaffId: z.string(),
        roomName: z.string(),
        roomCapacity: z.string()
      }),
    [requiredMessage]
  );

  const gradeDefaultValues: GradeFormValues = {
    name: "",
    minAge: "",
    maxAge: "",
    subjectIds: [],
    gradeChiefStaffId: "",
    roomName: "",
    roomCapacity: ""
  };

  const gradeForm = useForm<GradeFormValues>({
    resolver: zodResolver(gradeSchema),
    defaultValues: gradeDefaultValues
  });

  const activeSubjects = subjects.data?.filter((s) => s.status !== "archived") ?? [];
  const selectedSubjectIds = gradeForm.watch("subjectIds");
  const activeRooms = (classrooms.data ?? []).filter((r) => r.status !== "archived");

  const openCreateGrade = () => {
    gradeForm.reset(gradeDefaultValues);
    setGradeFormMode({ type: "create" });
  };

  const openEditGrade = () => {
    if (!selectedGrade) return;
    gradeForm.reset({
      name: selectedGrade.name,
      minAge: selectedGrade.minAge != null ? String(selectedGrade.minAge) : "",
      maxAge: selectedGrade.maxAge != null ? String(selectedGrade.maxAge) : "",
      subjectIds: selectedGrade.subjects.map((s) => s.id),
      gradeChiefStaffId: selectedGrade.gradeChiefStaffId ?? "",
      roomName: "",
      roomCapacity: ""
    });
    setGradeFormMode({ type: "edit", grade: selectedGrade });
  };

  const submitGrade = async (values: GradeFormValues) => {
    if (!contextYearId) return;
    const payload = {
      name: values.name,
      minAge: values.minAge ? Number(values.minAge) : null,
      maxAge: values.maxAge ? Number(values.maxAge) : null,
      academicYearId: contextYearId,
      subjectIds: values.subjectIds,
      gradeChiefStaffId: values.gradeChiefStaffId || null
    };

    if (gradeFormMode?.type === "edit") {
      await updateGrade.mutateAsync({ id: gradeFormMode.grade.id, ...payload });
    } else {
      const created = await createGrade.mutateAsync(payload);
      const gradeId = created.id;
      if (values.roomName.trim()) {
        await createRoom.mutateAsync({
          name: values.roomName.trim(),
          academicYearId: contextYearId,
          gradeId,
          capacity: values.roomCapacity ? Number(values.roomCapacity) : undefined
        });
      }
      selectGrade(gradeId);
    }
    setGradeFormMode(null);
    gradeForm.reset(gradeDefaultValues);
  };

  const openCreateRoom = () => setRoomFormMode({ type: "create" });
  const openEditRoom = (room: ClassroomOverview) => setRoomFormMode({ type: "edit", room });

  const submitRoom = async (values: ClassroomFormValues) => {
    if (!contextYearId || !selectedGradeId) return;
    if (roomFormMode?.type === "edit") {
      await updateRoom.mutateAsync({
        id: roomFormMode.room.id,
        name: values.name,
        room: values.room || null,
        capacity: values.capacity ? Number(values.capacity) : null,
        classTeacherStaffId: values.classTeacherStaffId || null
      });
    } else {
      await createRoom.mutateAsync({
        name: values.name,
        academicYearId: contextYearId,
        gradeId: selectedGradeId,
        room: values.room || undefined,
        capacity: values.capacity ? Number(values.capacity) : undefined,
        classTeacherStaffId: values.classTeacherStaffId || undefined
      });
    }
    setRoomFormMode(null);
  };

  if (currentYear.isLoading) {
    return <p className="pds-type-body-s-regular muted">{c("loading")}</p>;
  }

  if (!currentYear.data || !contextYearId) {
    return (
      <EmptyState
        icon="school"
        title={t("structureEmptyTitle")}
        description={setup("gradesClassroomsNeedYear")}
      />
    );
  }

  const stream = selectedGrade
    ? gradeStreamLabel(selectedGrade.minAge, selectedGrade.maxAge)
    : null;

  return (
    <>
      <PageHeader
        title={setup("gradesClassrooms")}
        breadcrumbs={[
          { label: nav("academicSetup") },
          { label: setup("gradesClassrooms") }
        ]}
      />

      <section className="module-strip module-strip--stack setup-grade-selector">
        <p className="pds-type-label-s-medium module-strip__label">{setup("selectGradeLevel")}</p>
        <div className="setup-grade-rail" aria-label={setup("selectGradeLevel")}>
          {activeGrades.map((grade) => {
            const active = grade.id === selectedGradeId;
            return (
              <button
                key={grade.id}
                type="button"
                className={active ? "pds-type-body-s-semibold setup-grade-chip setup-grade-chip--active" : "pds-type-body-s-semibold setup-grade-chip"}
                onClick={() => selectGrade(grade.id)}
              >
                {grade.name}
              </button>
            );
          })}
          <button type="button" className="pds-type-body-s-semibold setup-grade-add" onClick={openCreateGrade}>
            <Icon name="add" />
            {setup("newGrade")}
          </button>
        </div>
      </section>

      {!selectedGrade ? (
        <EmptyState compact embedded icon="school" title={t("structureNoGrades")} />
      ) : (
        <div className="setup-grade-layout">
          <aside className="setup-grade-sidebar">
            <div className="pds-type-title-xl-extrabold setup-grade-summary">
              <h3 className="pds-type-title-xxs-extrabold">{selectedGrade.name}</h3>
              {/* {stream ? <p className="pds-type-body-m-medium setup-grade-summary__stream">{stream}</p> : null} */}
              <div className="setup-grade-summary__chief">
                <span className="pds-type-label-s-medium setup-grade-summary__chief-label">{t("gradeChiefTitle")}</span>
                <strong className="pds-type-body-l-medium setup-grade-summary__chief-name">
                  {selectedGrade.gradeChiefName ?? t("gradeChiefUnassigned")}
                </strong>
              </div>
              <div className="setup-grade-summary__stats">
                <div>
                  <span className="pds-type-label-s-medium setup-grade-summary__stat-label">{setup("roomsStat")}</span>
                  <strong className="pds-type-display-m setup-grade-summary__stat-value">
                    {selectedGrade.classroomCount}
                  </strong>
                </div>
                <div>
                  <span className="pds-type-label-s-medium setup-grade-summary__stat-label">{setup("subjectsStat")}</span>
                  <strong className="pds-type-display-m setup-grade-summary__stat-value">
                    {selectedGrade.subjectCount}
                  </strong>
                </div>
              </div>
              <button type="button" className="pds-type-body-s-regular setup-grade-summary__edit" onClick={openEditGrade}>
                {t("editGradeTitle")}
              </button>
            </div>

            <div className="setup-subjects-offered">
              <p className="pds-type-label-s-medium setup-subjects-offered__label">{setup("subjectsOffered")}</p>
              {selectedGrade.subjects.length ? (
                <ul className="setup-subjects-offered__list">
                  {selectedGrade.subjects.map((subject) => {
                    const colors = subjectColor(subject.name);
                    return (
                      <li key={subject.id} className="setup-subjects-offered__item">
                        <span
                          className="setup-subjects-offered__dot"
                          style={{ background: colors.bg }}
                        />
                        <span className="pds-type-body-m-medium setup-subjects-offered__name">{subject.name}</span>
                        <Icon name={subjectIcon(subject.name)} className="pds-type-title-xs-bold setup-subjects-offered__icon" />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState compact embedded icon="menu_book" title={t("noSubjectsYet")} />
              )}
            </div>
          </aside>

          <section className="setup-classrooms-main">
            <div className="pds-type-title-xs-bold setup-classrooms-panel__head">
              <h3 className="pds-type-title-xxs-extrabold">{setup("classroomsInGrade", { grade: selectedGrade.name })}</h3>
              <button type="button" className="pds-type-body-m-bold btn-hero-primary" onClick={openCreateRoom}>
                <Icon name="add" />
                {setup("addRoom")}
              </button>
            </div>

            {classrooms.isLoading ? (
              <p className="pds-type-body-s-regular muted">{c("loading")}</p>
            ) : !activeRooms.length ? (
              <EmptyState compact embedded icon="meeting_room" title={t("structureNoRooms")} />
            ) : (
              <ul className="setup-classroom-list">
                {activeRooms.map((room) => {
                  const capacityLabel =
                    room.capacity != null
                      ? t("roomCapacityStudents", { capacity: room.capacity })
                      : t("roomStudentCount", { count: room.studentCount });
                  return (
                    <li key={room.id} className="setup-classroom-card">
                      <div className="setup-classroom-card__top">
                        <div className="pds-type-title-s-extrabold setup-classroom-card__identity">
                          <span className="pds-type-title-s-extrabold setup-classroom-card__mark" aria-hidden>
                            {roomLetter(room.name)}
                          </span>
                          <div>
                            <h4>{room.name}</h4>
                            <p className="pds-type-body-s-semibold setup-classroom-card__meta">{capacityLabel}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="pds-type-body-m-medium btn-outline setup-classroom-card__edit"
                          onClick={() => openEditRoom(room)}
                        >
                          {t("edit")}
                        </button>
                      </div>
                      <div className="pds-type-body-m-medium setup-classroom-card__homeroom">
                        <Icon name="person" />
                        <div className="pds-type-body-s-regular setup-classroom-card__homeroom-text">
                          <p className="pds-type-label-s-bold setup-classroom-card__homeroom-label">
                            {t("homeroomTeacher")}
                          </p>
                          <p>
                            {room.classTeacherName ?? t("homeroomUnassigned")}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="pds-type-body-m-bold btn-ghost"
                          onClick={() => openEditRoom(room)}
                        >
                          {setup("changeHomeroom")}
                          <Icon name="chevron_right" className="pds-type-body-m-medium ms" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      <RecordFormSheet
        open={gradeFormMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setGradeFormMode(null);
            gradeForm.reset(gradeDefaultValues);
          }
        }}
        title={
          gradeFormMode?.type === "edit" ? t("editGradeTitle") : setup("addGradeWithRoomTitle")
        }
        onSubmit={gradeForm.handleSubmit(submitGrade)}
        footer={
          <>
            <button
              type="button"
              className="pds-type-body-m-bold btn-ghost"
              onClick={() => {
                setGradeFormMode(null);
                gradeForm.reset(gradeDefaultValues);
              }}
            >
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="pds-type-body-m-bold btn-primary"
              disabled={gradeForm.formState.isSubmitting}
            >
              <Icon name="check" />
              {gradeForm.formState.isSubmitting
                ? t("creating")
                : gradeFormMode?.type === "edit"
                  ? c("save")
                  : t("addGrade")}
            </button>
          </>
        }
      >
        <Field label={t("gradeName")} error={gradeForm.formState.errors.name?.message}>
          <FormInput type="text" placeholder={t("gradeNamePlaceholder")} {...gradeForm.register("name")} />
        </Field>
        <Field label={t("minAge")}>
          <FormInput type="number" min={0} {...gradeForm.register("minAge")} />
        </Field>
        <Field label={t("maxAge")}>
          <FormInput type="number" min={0} {...gradeForm.register("maxAge")} />
        </Field>
        <Field label={t("gradeChiefTitle")}>
          <PdsSelectField
            variant="form"
            value={gradeForm.watch("gradeChiefStaffId")}
            onValueChange={(value) =>
              gradeForm.setValue("gradeChiefStaffId", typeof value === "string" ? value : "", {
                shouldDirty: true
              })
            }
            placeholder={t("selectGradeChief")}
            options={(teachers.data ?? []).map((member) => ({
              value: member.id,
              label: member.fullName
            }))}
          />
          <p className="pds-type-body-s-regular muted">{setup("gradeChiefHelp")}</p>
        </Field>
        <Field label={t("subjectsForGrade")}>
          <CheckboxList
            title={t("subjectsForGrade")}
            options={activeSubjects.map((s) => ({ id: s.id, label: s.name }))}
            selectedIds={selectedSubjectIds}
            onChange={(ids) => gradeForm.setValue("subjectIds", ids, { shouldDirty: true })}
            emptyTitle={t("noSubjectsYet")}
          />
        </Field>
        {gradeFormMode?.type === "create" ? (
          <>
            <p className="pds-type-body-s-regular setup-form-section-label">{setup("firstClassroomOptional")}</p>
            <Field label={t("classroomName")}>
              <FormInput type="text" placeholder={t("classroomNamePlaceholder")} {...gradeForm.register("roomName")} />
            </Field>
            <Field label={t("capacity")}>
              <FormInput type="number" min={1} {...gradeForm.register("roomCapacity")} />
            </Field>
          </>
        ) : null}
      </RecordFormSheet>

      <ClassroomFormSheet
        open={roomFormMode !== null}
        onOpenChange={(open) => {
          if (!open) setRoomFormMode(null);
        }}
        mode={roomFormMode?.type === "edit" ? "edit" : "create"}
        teachers={teachers.data ?? []}
        initialValues={
          roomFormMode?.type === "edit"
            ? {
                name: roomFormMode.room.name,
                room: roomFormMode.room.room ?? "",
                capacity:
                  roomFormMode.room.capacity != null
                    ? String(roomFormMode.room.capacity)
                    : "",
                classTeacherStaffId: roomFormMode.room.classTeacherStaffId ?? ""
              }
            : undefined
        }
        onSubmit={submitRoom}
      />
    </>
  );
}
