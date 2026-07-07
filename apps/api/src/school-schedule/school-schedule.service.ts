import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { schoolScheduleSettingsSchema, type SchoolScheduleSettings } from "@sms/shared";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { schoolOperatingHourBlocks, schoolScheduleSettings } from "../db/schema.js";

type OperatingHourBlockRow = {
  id?: string;
  label?: string | null;
  startsAt: string;
  endsAt: string;
  isPrimary: boolean;
  sortOrder: number;
};

@Injectable()
export class SchoolScheduleService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  async getSettings(tenantId: string) {
    const [settings] = await this.db
      .select()
      .from(schoolScheduleSettings)
      .where(eq(schoolScheduleSettings.tenantId, tenantId))
      .limit(1);

    const blocks = await this.db
      .select()
      .from(schoolOperatingHourBlocks)
      .where(eq(schoolOperatingHourBlocks.tenantId, tenantId))
      .orderBy(asc(schoolOperatingHourBlocks.sortOrder), asc(schoolOperatingHourBlocks.startsAt));

    if (!settings) {
      return {
        shortBreakStartsAt: null,
        shortBreakEndsAt: null,
        lunchBreakStartsAt: null,
        lunchBreakEndsAt: null,
        periodDurationMinutes: 45,
        workingDays: [1, 2, 3, 4, 5],
        operatingHourBlocks: blocks.map((block) => ({
          id: block.id,
          label: block.label,
          startsAt: block.startsAt,
          endsAt: block.endsAt,
          isPrimary: block.isPrimary,
          sortOrder: block.sortOrder
        }))
      };
    }

    return {
      shortBreakStartsAt: settings.shortBreakStartsAt,
      shortBreakEndsAt: settings.shortBreakEndsAt,
      lunchBreakStartsAt: settings.lunchBreakStartsAt,
      lunchBreakEndsAt: settings.lunchBreakEndsAt,
      periodDurationMinutes: settings.periodDurationMinutes,
      workingDays: settings.workingDays,
      operatingHourBlocks: blocks.map((block) => ({
        id: block.id,
        label: block.label,
        startsAt: block.startsAt,
        endsAt: block.endsAt,
        isPrimary: block.isPrimary,
        sortOrder: block.sortOrder
      }))
    };
  }

  async upsertSettings(tenantId: string, actorUserId: string, raw: SchoolScheduleSettings) {
    const dto = schoolScheduleSettingsSchema.parse(raw);

    if (!dto.operatingHourBlocks.some((block) => block.isPrimary)) {
      throw new BadRequestException("At least one operating hour block must be marked as primary.");
    }

    const primaryCount = dto.operatingHourBlocks.filter((block) => block.isPrimary).length;
    if (primaryCount > 1) {
      throw new BadRequestException("Only one operating hour block can be primary.");
    }

    for (const block of dto.operatingHourBlocks) {
      if (block.startsAt >= block.endsAt) {
        throw new BadRequestException("Operating hour end time must be after start time.");
      }
    }

    if (dto.shortBreakStartsAt && dto.shortBreakEndsAt && dto.shortBreakStartsAt >= dto.shortBreakEndsAt) {
      throw new BadRequestException("Short break end time must be after start time.");
    }

    if (dto.lunchBreakStartsAt && dto.lunchBreakEndsAt && dto.lunchBreakStartsAt >= dto.lunchBreakEndsAt) {
      throw new BadRequestException("Lunch break end time must be after start time.");
    }

    const [existingSettings] = await this.db
      .select()
      .from(schoolScheduleSettings)
      .where(eq(schoolScheduleSettings.tenantId, tenantId))
      .limit(1);

    if (existingSettings) {
      await this.db
        .update(schoolScheduleSettings)
        .set({
          shortBreakStartsAt: dto.shortBreakStartsAt ?? null,
          shortBreakEndsAt: dto.shortBreakEndsAt ?? null,
          lunchBreakStartsAt: dto.lunchBreakStartsAt ?? null,
          lunchBreakEndsAt: dto.lunchBreakEndsAt ?? null,
          periodDurationMinutes: dto.periodDurationMinutes,
          workingDays: dto.workingDays,
          updatedBy: actorUserId,
          updatedAt: new Date()
        })
        .where(eq(schoolScheduleSettings.id, existingSettings.id));
    } else {
      await this.db.insert(schoolScheduleSettings).values({
        tenantId,
        shortBreakStartsAt: dto.shortBreakStartsAt ?? null,
        shortBreakEndsAt: dto.shortBreakEndsAt ?? null,
        lunchBreakStartsAt: dto.lunchBreakStartsAt ?? null,
        lunchBreakEndsAt: dto.lunchBreakEndsAt ?? null,
        periodDurationMinutes: dto.periodDurationMinutes,
        workingDays: dto.workingDays,
        createdBy: actorUserId,
        updatedBy: actorUserId
      });
    }

    const existingBlocks = await this.db
      .select({ id: schoolOperatingHourBlocks.id })
      .from(schoolOperatingHourBlocks)
      .where(eq(schoolOperatingHourBlocks.tenantId, tenantId));

    const incomingIds = new Set(
      dto.operatingHourBlocks.map((block) => block.id).filter((id): id is string => Boolean(id))
    );

    for (const block of existingBlocks) {
      if (!incomingIds.has(block.id)) {
        await this.db
          .delete(schoolOperatingHourBlocks)
          .where(
            and(
              eq(schoolOperatingHourBlocks.id, block.id),
              eq(schoolOperatingHourBlocks.tenantId, tenantId)
            )
          );
      }
    }

    for (const block of dto.operatingHourBlocks) {
      if (block.id) {
        await this.db
          .update(schoolOperatingHourBlocks)
          .set({
            label: block.label ?? null,
            startsAt: block.startsAt,
            endsAt: block.endsAt,
            isPrimary: block.isPrimary,
            sortOrder: block.sortOrder,
            updatedBy: actorUserId,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(schoolOperatingHourBlocks.id, block.id),
              eq(schoolOperatingHourBlocks.tenantId, tenantId)
            )
          );
      } else {
        await this.db.insert(schoolOperatingHourBlocks).values({
          tenantId,
          label: block.label ?? null,
          startsAt: block.startsAt,
          endsAt: block.endsAt,
          isPrimary: block.isPrimary,
          sortOrder: block.sortOrder,
          createdBy: actorUserId,
          updatedBy: actorUserId
        });
      }
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "school_schedule.update",
      recordType: "SchoolScheduleSettings",
      recordId: tenantId,
      after: { blockCount: dto.operatingHourBlocks.length }
    });

    return this.getSettings(tenantId);
  }
}

function parseMinutes(value: string) {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function buildPeriodRowsFromSchedule(input: {
  academicYearId: string;
  tenantId: string;
  actorUserId: string;
  periodDurationMinutes: number;
  shortBreakStartsAt: string | null;
  shortBreakEndsAt: string | null;
  lunchBreakStartsAt: string | null;
  lunchBreakEndsAt: string | null;
  blocks: OperatingHourBlockRow[];
}) {
  const rows: Array<{
    tenantId: string;
    academicYearId: string;
    operatingHourBlockId?: string;
    name: string;
    startsAt: string;
    endsAt: string;
    sortOrder: number;
    periodType: string;
    isBreak: boolean;
    createdBy: string;
    updatedBy: string;
  }> = [];

  let lessonCounter = 0;
  let sortOrder = 0;

  const shortStart = input.shortBreakStartsAt ? parseMinutes(input.shortBreakStartsAt) : null;
  const shortEnd = input.shortBreakEndsAt ? parseMinutes(input.shortBreakEndsAt) : null;
  const lunchStart = input.lunchBreakStartsAt ? parseMinutes(input.lunchBreakStartsAt) : null;
  const lunchEnd = input.lunchBreakEndsAt ? parseMinutes(input.lunchBreakEndsAt) : null;

  const sortedBlocks = [...input.blocks].sort((a, b) => a.sortOrder - b.sortOrder || a.startsAt.localeCompare(b.startsAt));

  const pushBreak = (
    type: "short_break" | "lunch_break",
    name: string,
    startsAt: string,
    endsAt: string,
    blockId?: string
  ) => {
    rows.push({
      tenantId: input.tenantId,
      academicYearId: input.academicYearId,
      operatingHourBlockId: blockId,
      name,
      startsAt,
      endsAt,
      sortOrder: sortOrder++,
      periodType: type,
      isBreak: true,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId
    });
  };

  for (const block of sortedBlocks) {
    const blockStart = parseMinutes(block.startsAt);
    const blockEnd = parseMinutes(block.endsAt);
    let cursor = blockStart;
    const includeBreaks = block.isPrimary;

    while (cursor + input.periodDurationMinutes <= blockEnd) {
      const nextEnd = cursor + input.periodDurationMinutes;

      if (includeBreaks && shortStart !== null && shortEnd !== null && cursor <= shortStart && nextEnd > shortStart) {
        if (!rows.some((row) => row.periodType === "short_break")) {
          pushBreak(
            "short_break",
            "Short break",
            input.shortBreakStartsAt!,
            input.shortBreakEndsAt!,
            block.id
          );
        }
        cursor = shortEnd;
        continue;
      }

      if (includeBreaks && lunchStart !== null && lunchEnd !== null && cursor <= lunchStart && nextEnd > lunchStart) {
        if (!rows.some((row) => row.periodType === "lunch_break")) {
          pushBreak(
            "lunch_break",
            "Lunch break",
            input.lunchBreakStartsAt!,
            input.lunchBreakEndsAt!,
            block.id
          );
        }
        cursor = lunchEnd;
        continue;
      }

      if (
        includeBreaks &&
        shortStart !== null &&
        shortEnd !== null &&
        cursor >= shortStart &&
        cursor < shortEnd
      ) {
        cursor = shortEnd;
        continue;
      }

      if (
        includeBreaks &&
        lunchStart !== null &&
        lunchEnd !== null &&
        cursor >= lunchStart &&
        cursor < lunchEnd
      ) {
        cursor = lunchEnd;
        continue;
      }

      lessonCounter += 1;
      rows.push({
        tenantId: input.tenantId,
        academicYearId: input.academicYearId,
        operatingHourBlockId: block.id,
        name: `P${lessonCounter}`,
        startsAt: formatMinutes(cursor),
        endsAt: formatMinutes(nextEnd),
        sortOrder: sortOrder++,
        periodType: "lesson",
        isBreak: false,
        createdBy: input.actorUserId,
        updatedBy: input.actorUserId
      });
      cursor = nextEnd;
    }
  }

  return rows;
}
