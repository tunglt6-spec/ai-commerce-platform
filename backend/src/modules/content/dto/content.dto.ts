import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateContentDto {
  @IsIn(['product_description', 'caption', 'video_script', 'email', 'social_post'])
  content_type!: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsUUID()
  product_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsBoolean()
  ai_generated?: boolean;

  @IsOptional()
  @IsString()
  ai_model_used?: string;
}

export class ApproveContentDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ScheduleContentDto {
  @IsString()
  scheduled_date!: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  scheduled_time?: string;
}

export class ContentQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['draft', 'pending_review', 'approved', 'published', 'archived'])
  status?: string;

  @IsOptional()
  @IsString()
  content_type?: string;
}
