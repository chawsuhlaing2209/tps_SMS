import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";
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

  @IsUUID()
  declare feeItemId: string;

  @IsString()
  declare effectiveFrom: string;
}

export class CreateStudentServiceDto {
  @IsUUID()
  declare studentId: string;

  @IsUUID()
  declare feeItemId: string;

  @IsString()
  declare startDate: string;

  @IsOptional()
  @IsString()
  declare endDate?: string;

  @IsOptional()
  @IsString()
  declare dueDate?: string;
}
