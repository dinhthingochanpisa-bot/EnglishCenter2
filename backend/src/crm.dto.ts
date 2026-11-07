import { Equals,IsDateString,IsEnum,IsInt,IsNotEmpty,IsOptional,IsString,IsUUID,Max,MaxLength,Min } from 'class-validator';
export const LEAD_STATUSES=['NEW','CONTACTING','QUALIFIED','APPOINTMENT','CONVERTED','CLOSED_LOST'] as const;
export const SOURCE_CATEGORIES=['EVENT','SCHOOL','PAGE','ZALO_OA','GOOGLE_ADS','REFERRAL','COLLABORATOR','WALK_IN','OTHER'] as const;
export class CreatePersonDto {
 @IsUUID() branchId!:string;
 @IsString() @IsNotEmpty() @MaxLength(240) fullName!:string;
 @IsOptional() @IsDateString() dateOfBirth?:string;
 @IsOptional() @IsString() @MaxLength(24) gender?:string;
 @IsOptional() @IsString() @MaxLength(240) schoolName?:string;
 @IsOptional() @IsString() @MaxLength(40) schoolGrade?:string;
 @IsOptional() @IsString() @MaxLength(500) address?:string;
}
export class UpdatePersonDto {
 @IsUUID() branchId!:string;
 @IsInt() @Min(1) rowVersion!:number;
 @IsOptional() @IsString() @IsNotEmpty() @MaxLength(240) fullName?:string;
 @IsOptional() @IsString() @MaxLength(240) schoolName?:string;
 @IsOptional() @IsString() @MaxLength(40) schoolGrade?:string;
 @IsOptional() @IsString() @MaxLength(500) address?:string;
}
export class CreateSourceDto {
 @IsString() @IsNotEmpty() @MaxLength(70) code!:string;
 @IsString() @IsNotEmpty() @MaxLength(180) name!:string;
 @IsEnum(SOURCE_CATEGORIES) category!:typeof SOURCE_CATEGORIES[number];
}
export class CreateCampaignDto {
 @IsString() @IsNotEmpty() @MaxLength(80) code!:string;
 @IsString() @IsNotEmpty() @MaxLength(200) name!:string;
 @IsOptional() @IsUUID() sourceId?:string;
 @IsOptional() @IsDateString() startAt?:string;
 @IsOptional() @IsDateString() endAt?:string;
}
export class CreateLeadDto {
 @IsUUID() branchId!:string;
 @IsOptional() @IsUUID() personId?:string;
 @IsOptional() @IsString() @IsNotEmpty() @MaxLength(240) studentName?:string;
 @IsOptional() @IsString() @MaxLength(240) contactName?:string;
 @IsOptional() @IsString() @MaxLength(40) contactPhone?:string;
 @IsUUID() sourceId!:string;
 @IsOptional() @IsUUID() campaignId?:string;
 @IsOptional() @IsUUID() assignedMembershipId?:string;
}
export class UpdateLeadDto {
 @IsInt() @Min(1) rowVersion!:number;
 @IsOptional() @IsEnum(LEAD_STATUSES) status?:typeof LEAD_STATUSES[number];
 @IsOptional() @IsString() @MaxLength(40) contactPhone?:string;
 @IsOptional() @IsUUID() assignedMembershipId?:string;
 @IsOptional() @IsDateString() nextFollowupAt?:string;
}
export class CreateActivityDto {
 @IsEnum(['CALL','MESSAGE','NOTE','MEETING','FOLLOWUP']) kind!:'CALL'|'MESSAGE'|'NOTE'|'MEETING'|'FOLLOWUP';
 @IsString() @IsNotEmpty() @MaxLength(5000) note!:string;
 @IsOptional() @IsString() @MaxLength(60) outcome?:string;
 @IsOptional() @IsDateString() followupAt?:string;
}
export class CreateTouchDto {
 @IsUUID() sourceId!:string;
 @IsOptional() @IsUUID() campaignId?:string;
 @IsString() @IsNotEmpty() @MaxLength(40) touchType!:string;
}
export class CreateCheckinDto {
 @IsUUID() branchId!:string;
 @IsUUID() personId!:string;
 @IsOptional() @IsUUID() leadId?:string;
 @IsUUID() sourceId!:string;
 @IsOptional() @IsString() @MaxLength(160) purpose?:string;
}
export class CompleteCheckinDto {
 @IsDateString() dateOfBirth!:string;
 @IsString() @IsNotEmpty() @MaxLength(240) schoolName!:string;
 @IsString() @IsNotEmpty() @MaxLength(40) schoolGrade!:string;
 @IsOptional() @IsString() @IsNotEmpty() @MaxLength(240) guardianName?:string;
 @IsOptional() @IsString() @IsNotEmpty() @MaxLength(40) guardianPhone?:string;
 @IsOptional() @IsUUID() intakeSubmissionId?:string;
 @IsOptional() @IsString() @MaxLength(40) guardianRelation?:string;
}
export class CreateIntakeInviteDto {
 @IsUUID() branchId!:string;
 @IsOptional() @IsUUID() leadId?:string;
 @IsOptional() @IsInt() @Min(5) @Max(120) expiresMinutes?:number;
}
export class SubmitIntakeDto {
 @Equals(true) consentAccepted!:true;
 @IsString() @IsNotEmpty() @MaxLength(240) fullName!:string;
 @IsString() @IsNotEmpty() @MaxLength(240) guardianName!:string;
 @IsString() @IsNotEmpty() @MaxLength(40) guardianPhone!:string;
 @IsOptional() @IsDateString() dateOfBirth?:string;
 @IsOptional() @IsString() @MaxLength(240) schoolName?:string;
 @IsOptional() @IsString() @MaxLength(40) schoolGrade?:string;
}
export class ReviewIntakeDto {
 @IsEnum(['CONFIRMED','REJECTED']) decision!:'CONFIRMED'|'REJECTED';
 @IsOptional() @IsUUID() existingPersonId?:string;
}
