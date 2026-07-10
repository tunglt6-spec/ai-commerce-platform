import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class ConnectIntegrationDto {
  /** Secret API key — stored as a non-reversible reference, never returned or logged. */
  @IsOptional()
  @IsString()
  api_key?: string;

  /** OAuth access token — treated as secret. */
  @IsOptional()
  @IsString()
  access_token?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  expires_in?: number;

  /** Non-secret settings (e.g. shop id, region). */
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
