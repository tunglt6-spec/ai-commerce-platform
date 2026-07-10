import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class GenerateDescriptionDto {
  @IsUUID()
  product_id!: string;

  @IsOptional()
  @IsString()
  target_platform = 'website';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  variations = 3;
}

export class GenerateCaptionDto {
  @IsUUID()
  product_id!: string;

  @IsOptional()
  @IsString()
  platform = 'tiktok';

  @IsOptional()
  @IsIn(['playful', 'aspirational', 'educational'])
  vibe = 'playful';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  variations = 3;
}

export class GenerateVideoScriptDto {
  @IsUUID()
  product_id!: string;

  @IsOptional()
  @IsString()
  video_type = 'unboxing';

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(120)
  duration_seconds = 30;
}

export class ApproveTaskDto {
  @IsBoolean()
  approved!: boolean;
}
