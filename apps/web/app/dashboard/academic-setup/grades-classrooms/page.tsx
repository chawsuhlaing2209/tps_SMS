"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CheckboxList } from "../../../../components/shared/checkbox-list";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/icon";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { zodResolver } from "../../../lib/zod-resolver";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { PageHeader } from "../../page-header-context";
import { gradeBadgeLabel, gradeStreamLabel } from "../grade-label";
import {
  ClassroomFormSheet,
  type ClassroomFormValues
} from "../../structure/classroom-form-sheet";
import { roomAccentColor, roomLetter, subjectColor, subjectIcon } from "../../structure/subject-colors";
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
      subjectIds: values.subjectIds
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
    return <p className="muted">{c("loading")}</p>;
  }

  if (!currentYear.data || !contextYearId) {
    return (
      <div className="setup-empty">
        <h2>{t("structureEmptyTitle")}</h2>
        <p className="muted">{setup("gradesClassroomsNeedYear")}</p>
      </div>
    );
  }

  const stream = selectedGrade
    ? gradeStreamLabel(selectedGrade.minAge, selectedGrade.maxAge)
    : null;

  return (
    <div className="setup-grades-page">
      <PageHeader
        title={setup("gradesClassrooms")}
        description={setup("gradesClassroomsHelp")}
        breadcrumbs={[
          { label: nav("academicSetup") },
          { label: setup("gradesClassrooms") }
        ]}
      />

      <p className="setup-section-label">{setup("selectGradeLevel")}</p>
      <div className="structure-grade-scroll">
        <div className="structure-grade-rail setup-grade-rail" aria-label={setup("selectGradeLevel")}>
          {activeGrades.map((grade) => {
            const active = grade.id === selectedGradeId;
            return (
              <button
                key={grade.id}
                type="button"
                className={
                  active ? "structure-grade-chip structure-grade-chip--active" : "structure-grade-chip"
                }
                onClick={() => selectGrade(grade.id)}
              >
                <span className="structure-grade-chip__name">{grade.name}</span>
              </button>
            );
          })}
          <button type="button" className="setup-grade-add" onClick={openCreateGrade}>
            <Icon name="add" />
            {t("addGrade")}
          </button>
        </div>
      </div>

      {!selectedGrade ? (
        <div className="setup-empty setup-empty--compact">
          <p className="muted">{t("structureNoGrades")}</p>
          <button type="button" className="btn-primary" onClick={openCreateGrade}>
            <Icon name="add" />
            {t("addGrade")}
          </button>
        </div>
      ) : (
        <div className="setup-grade-layout">
          <aside className="setup-grade-sidebar">
            <div className="setup-grade-summary">
              <h3>{selectedGrade.name}</h3>
              {stream ? <p className="setup-grade-summary__stream">{stream}</p> : null}
              <div className="setup-grade-summary__stats">
                <div>
                  <span className="setup-grade-summary__stat-label">{setup("roomsStat")}</span>
                  <strong className="setup-grade-summary__stat-value">
                    {selectedGrade.classroomCount}
                  </strong>
                </div>
                <div>
                  <span className="setup-grade-summary__stat-label">{setup("subjectsStat")}</span>
                  <strong className="setup-grade-summary__stat-value">
                    {selectedGrade.subjectCount}
                  </strong>
                </div>
              </div>
              <button type="button" className="setup-grade-summary__edit" onClick={openEditGrade}>
                {t("editGradeTitle")}
              </button>
            </div>

            <div className="setup-subjects-offered">
              <p className="setup-subjects-offered__label">{setup("subjectsOffered")}</p>
              <ul className="setup-subjects-offered__list">
                {selectedGrade.subjects.length ? (
                  selectedGrade.subjects.map((subject) => {
                    const colors = subjectColor(subject.name);
                    return (
                      <li key={subject.id} className="setup-subjects-offered__item">
                        <span
                          className="setup-subjects-offered__dot"
                          style={{ background: colors.bg }}
                        />
                        <span className="setup-subjects-offered__name">{subject.name}</span>
                        <Icon name={subjectIcon(subject.name)} className="setup-subjects-offered__icon" />
                      </li>
                    );
                  })
                ) : (
                  <li className="muted">{t("noSubjectsYet")}</li>
                )}
              </ul>
            </div>
          </aside>

          <section className="setup-classrooms-panel">
            <div className="setup-classrooms-panel__head">
              <h3>{setup("classroomsInGrade", { grade: selectedGrade.name })}</h3>
              <button type="button" className="btn-primary setup-add-room" onClick={openCreateRoom}>
                <Icon name="add" />
                {setup("addRoom")}
              </button>
            </div>

            {classrooms.isLoading ? (
              <p className="muted">{c("loading")}</p>
            ) : !activeRooms.length ? (
              <div className="setup-empty setup-empty--compact">
                <p className="muted">{t("structureNoRooms")}</p>
                <button type="button" className="btn-primary" onClick={openCreateRoom}>
                  <Icon name="add" />
                  {setup("addRoom")}
                </button>
              </div>
            ) : (
              <ul className="setup-classroom-list">
                {activeRooms.map((room) => {
                  const accent = roomAccentColor(room.name);
                  const capacityLabel =
                    room.capacity != null
                      ? t("roomCapacityStudents", {
                          capacity: room.capacity,
                          count: room.studentCount
                        })
                      : t("roomStudentCount", { count: room.studentCount });
                  return (
                    <li key={room.id} className="setup-classroom-card">
                      <div className="setup-classroom-card__top">
                        <div className="setup-classroom-card__identity">
                          <span
                            className="structure-room-card__mark"
                            style={{ background: accent }}
                          >
                            {roomLetter(room.name)}
                          </span>
                          <div>
                            <h4>{room.name}</h4>
                            <p className="muted">{capacityLabel}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-outline setup-classroom-card__edit"
                          onClick={() => openEditRoom(room)}
                        >
                          {t("edit")}
                        </button>
                      </div>
                      <div className="setup-classroom-card__homeroom">
                        <Icon name="person" />
                        <div className="setup-classroom-card__homeroom-text">
                          <span className="setup-classroom-card__homeroom-label">
                            {t("homeroomTeacher")}
                          </span>
                          <strong>
                            {room.classTeacherName ?? t("homeroomUnassigned")}
                          </strong>
                        </div>
                        <button
                          type="button"
                          className="setup-classroom-card__change"
                          onClick={() => openEditRoom(room)}
                        >
                          {setup("changeHomeroom")}
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
              className="btn-ghost"
              onClick={() => {
                setGradeFormMode(null);
                gradeForm.reset(gradeDefaultValues);
              }}
            >
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="btn-primary"
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
          <input type="text" placeholder={t("gradeNamePlaceholder")} {...gradeForm.register("name")} />
        </Field>
        <Field label={t("minAge")}>
          <input type="number" min={0} {...gradeForm.register("minAge")} />
        </Field>
        <Field label={t("maxAge")}>
          <input type="number" min={0} {...gradeForm.register("maxAge")} />
        </Field>
        <Field label={t("subjectsForGrade")}>
          <CheckboxList
            options={activeSubjects.map((s) => ({ id: s.id, label: s.name }))}
            selectedIds={selectedSubjectIds}
            onChange={(ids) => gradeForm.setValue("subjectIds", ids, { shouldDirty: true })}
            emptyMessage={<p className="muted">{t("noSubjectsYet")}</p>}
          />
        </Field>
        {gradeFormMode?.type === "create" ? (
          <>
            <p className="setup-form-section-label">{setup("firstClassroomOptional")}</p>
            <Field label={t("classroomName")}>
              <input type="text" placeholder={t("classroomNamePlaceholder")} {...gradeForm.register("roomName")} />
            </Field>
            <Field label={t("capacity")}>
              <input type="number" min={1} {...gradeForm.register("roomCapacity")} />
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
    </div>
  );
}
