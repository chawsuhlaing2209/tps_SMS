import { SetMetadata } from "@nestjs/common";

export const TEACHER_SCOPE_KEY = "teacher_scope";

export interface TeacherScopeOptions {
  /** Route param name that carries a classroom id. */
  classroomIdParam?: string;
  /** Route param name that carries a subject id. */
  subjectIdParam?: string;
  /** Query param name that carries a subject id. */
  subjectIdQuery?: string;
  /** Route param name that carries an attendance session id. */
  attendanceSessionIdParam?: string;
}

/** Enforces teacher assignment scoping after permission checks succeed. */
export const TeacherScoped = (options: TeacherScopeOptions) =>
  SetMetadata(TEACHER_SCOPE_KEY, options);
