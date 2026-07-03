import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { and, asc, eq, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { classrooms, facilityRooms } from "../db/schema.js";
import type { CreateFacilityRoomDto, UpdateFacilityRoomDto } from "./dto.js";

@Injectable()
export class FacilitiesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  listFacilityRooms(tenantId: string) {
    return this.db
      .select({
        id: facilityRooms.id,
        name: facilityRooms.name,
        capacity: facilityRooms.capacity,
        note: facilityRooms.note,
        status: facilityRooms.status
      })
      .from(facilityRooms)
      .where(eq(facilityRooms.tenantId, tenantId))
      .orderBy(asc(facilityRooms.name));
  }

  listActiveFacilityRooms(tenantId: string) {
    return this.db
      .select({
        id: facilityRooms.id,
        name: facilityRooms.name,
        capacity: facilityRooms.capacity,
        note: facilityRooms.note
      })
      .from(facilityRooms)
      .where(and(eq(facilityRooms.tenantId, tenantId), eq(facilityRooms.status, "active")))
      .orderBy(asc(facilityRooms.name));
  }

  async getFacilityRoom(tenantId: string, roomId: string) {
    const [room] = await this.db
      .select({
        id: facilityRooms.id,
        name: facilityRooms.name,
        capacity: facilityRooms.capacity,
        note: facilityRooms.note,
        status: facilityRooms.status
      })
      .from(facilityRooms)
      .where(and(eq(facilityRooms.tenantId, tenantId), eq(facilityRooms.id, roomId)));

    if (!room) {
      throw new NotFoundException("Facility room not found.");
    }

    return room;
  }

  async createFacilityRoom(
    tenantId: string,
    actorUserId: string | undefined,
    dto: CreateFacilityRoomDto
  ) {
    const name = dto.name.trim();
    const [existing] = await this.db
      .select({ id: facilityRooms.id })
      .from(facilityRooms)
      .where(and(eq(facilityRooms.tenantId, tenantId), eq(facilityRooms.name, name)));

    if (existing) {
      throw new ConflictException(`Room "${name}" already exists.`);
    }

    const [room] = await this.db
      .insert(facilityRooms)
      .values({
        tenantId,
        name,
        capacity: dto.capacity ?? null,
        note: dto.note?.trim() || null,
        status: "active"
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "facility_room.create",
      recordType: "FacilityRoom",
      recordId: room!.id,
      after: {
        name,
        capacity: dto.capacity ?? null,
        note: dto.note?.trim() || null
      }
    });

    return this.getFacilityRoom(tenantId, room!.id);
  }

  async updateFacilityRoom(
    tenantId: string,
    roomId: string,
    actorUserId: string | undefined,
    dto: UpdateFacilityRoomDto
  ) {
    const [existing] = await this.db
      .select()
      .from(facilityRooms)
      .where(and(eq(facilityRooms.tenantId, tenantId), eq(facilityRooms.id, roomId)));

    if (!existing) {
      throw new NotFoundException("Facility room not found.");
    }

    const name = dto.name?.trim();
    if (name && name !== existing.name) {
      const [conflict] = await this.db
        .select({ id: facilityRooms.id })
        .from(facilityRooms)
        .where(and(eq(facilityRooms.tenantId, tenantId), eq(facilityRooms.name, name)));

      if (conflict) {
        throw new ConflictException(`Room "${name}" already exists.`);
      }
    }

    await this.db
      .update(facilityRooms)
      .set({
        ...(name ? { name } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        updatedAt: new Date()
      })
      .where(and(eq(facilityRooms.tenantId, tenantId), eq(facilityRooms.id, roomId)));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "facility_room.update",
      recordType: "FacilityRoom",
      recordId: roomId,
      before: {
        name: existing.name,
        capacity: existing.capacity,
        note: existing.note,
        status: existing.status
      },
      after: {
        ...(name ? { name } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
        ...(dto.status ? { status: dto.status } : {})
      }
    });

    return this.getFacilityRoom(tenantId, roomId);
  }

  private async getRoomOrThrow(tenantId: string, roomId: string) {
    const [room] = await this.db
      .select()
      .from(facilityRooms)
      .where(and(eq(facilityRooms.tenantId, tenantId), eq(facilityRooms.id, roomId)));
    if (!room) {
      throw new NotFoundException("Facility room not found.");
    }
    return room;
  }

  private async setStatus(
    tenantId: string,
    roomId: string,
    status: "active" | "archived",
    action: string,
    actorUserId: string | undefined
  ) {
    const previous = await this.getRoomOrThrow(tenantId, roomId);

    await this.db
      .update(facilityRooms)
      .set({ status, updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(facilityRooms.tenantId, tenantId), eq(facilityRooms.id, roomId)));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action,
      recordType: "FacilityRoom",
      recordId: roomId,
      before: { status: previous.status },
      after: { status }
    });

    return this.getFacilityRoom(tenantId, roomId);
  }

  archiveFacilityRoom(tenantId: string, roomId: string, actorUserId: string | undefined) {
    return this.setStatus(tenantId, roomId, "archived", "facility_room.archive", actorUserId);
  }

  restoreFacilityRoom(tenantId: string, roomId: string, actorUserId: string | undefined) {
    return this.setStatus(tenantId, roomId, "active", "facility_room.restore", actorUserId);
  }

  async deleteFacilityRoom(tenantId: string, roomId: string, actorUserId: string | undefined) {
    const room = await this.getRoomOrThrow(tenantId, roomId);

    // Two-step safety: archive the room before deleting it permanently.
    if (room.status !== "archived") {
      throw new BadRequestException("Archive the room before deleting it.");
    }

    const [used] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(classrooms)
      .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.facilityRoomId, roomId)));
    if ((used?.n ?? 0) > 0) {
      throw new ConflictException({
        message: "This room is assigned to classrooms and cannot be deleted. Keep it archived instead.",
        dependencies: { classrooms: used?.n ?? 0 }
      });
    }

    await this.db
      .delete(facilityRooms)
      .where(and(eq(facilityRooms.tenantId, tenantId), eq(facilityRooms.id, roomId)));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "facility_room.delete",
      recordType: "FacilityRoom",
      recordId: roomId,
      before: { name: room.name, status: room.status },
      after: { deleted: true }
    });

    return { id: roomId, deleted: true };
  }
}
