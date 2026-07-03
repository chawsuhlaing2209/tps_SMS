import { ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";
import { Type } from "class-transformer";
import { paymentMethods } from "@sms/shared";

export class ListEnrollmentsQueryDto {
  @IsOptional()
  @IsUUID()
  declare academicYearId?: string;

  @IsOptional()
  @IsUUID()
  declare studentId?: string;

  @IsOptional()
  @IsString()
  declare status?: string;
}

export class PreviewEnrollmentDto {
  @IsUUID()
  declare studentId: string;

  @IsUUID()
  declare academicYearId: string;

  @IsUUID()
  declare gradeId: string;

  @IsOptional()
  @IsUUID()
  declare classroomId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  optionalFeeItemIds?: string[];

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  collectPayment?: boolean;

  @IsOptional()
  @IsString()
  @IsIn([...paymentMethods])
  paymentMethod?: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  excludedDiscountRuleIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  forcedDiscountRuleIds?: string[];
}

export class CreateEnrollmentDto {
  @IsUUID()
  declare studentId: string;

  @IsOptional()
  @IsUUID()
  declare classroomId?: string;

  @IsUUID()
  declare academicYearId: string;

  @IsUUID()
  declare gradeId: string;

  @IsOptional()
  @IsUUID()
  declare enquiryId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  optionalFeeItemIds?: string[];
}

export class AssignClassroomDto {
  @IsUUID()
  declare classroomId: string;
}

export class UpdateEnrollmentDto {
  @IsOptional()
  @IsString()
  declare status?: string;

  @IsOptional()
  @IsUUID()
  declare classroomId?: string;

  @IsOptional()
  @IsUUID()
  declare gradeId?: string;

  @IsOptional()
  @IsUUID()
  declare academicYearId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  optionalFeeItemIds?: string[];
}

export class ConfirmEnrollmentDto {
  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  optionalFeeItemIds?: string[];

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  collectPayment?: boolean;

  @IsOptional()
  @IsString()
  @IsIn([...paymentMethods])
  paymentMethod?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  paymentAmount?: number;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsString()
  paymentNotes?: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  excludedDiscountRuleIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  forcedDiscountRuleIds?: string[];
}

export class ListStudentServicesQueryDto {
  @IsOptional()
  @IsUUID()
  declare studentId?: string;
}

export class ListAvailableStudentServicesQueryDto {
  @IsUUID()
  declare studentId: string;
}

export class PreviewAddStudentServiceDto {
  @IsUUID()
  declare studentId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  declare feeItemIds: string[];

  @IsString()
  declare effectiveFrom: string;
}

export class CreateStudentServiceDto {
  @IsUUID()
  declare studentId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  declare feeItemIds: string[];

  @IsString()
  declare startDate: string;

  @IsOptional()
  @IsString()
  declare endDate?: string;

  @IsOptional()
  @IsString()
  declare dueDate?: string;

  @IsOptional()
  @IsBoolean()
  declare collectPayment?: boolean;

  @IsOptional()
  @IsIn([...paymentMethods])
  declare paymentMethod?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  declare paymentAmount?: number;

  @IsOptional()
  @IsString()
  declare paymentReference?: string;

  @IsOptional()
  @IsString()
  declare paymentNotes?: string;
}

export class CancelEnrollmentDto {
  @IsIn(["full", "partial", "none"])
  declare refundMode: "full" | "partial" | "none";

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  declare refundAmount?: number;

  @IsOptional()
  @IsIn([...paymentMethods])
  declare method?: string;

  @IsOptional()
  @IsString()
  declare referenceNumber?: string;

  @IsString()
  declare reason: string;
}
