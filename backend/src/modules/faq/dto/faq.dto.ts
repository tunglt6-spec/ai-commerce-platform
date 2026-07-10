import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateFaqDto {
  @IsString()
  category!: string;

  @IsString()
  question!: string;

  @IsString()
  answer!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}

export class UpdateFaqDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  question?: string;

  @IsOptional()
  @IsString()
  answer?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}

export class SalesRespondDto {
  @IsString()
  question!: string;

  @IsOptional()
  @IsUUID()
  product_id?: string;
}
