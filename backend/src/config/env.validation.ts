import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Environment variable schema. Validated at boot — the process fails fast
 * (rather than starting in a broken state) if a required var is missing.
 */
export class EnvVars {
  @IsIn(['development', 'test', 'production'])
  @IsOptional()
  NODE_ENV: string = 'development';

  @IsNotEmpty()
  @IsString()
  DATABASE_URL!: string;

  @IsOptional()
  @IsNumber()
  BACKEND_PORT: number = 3001;

  @IsString()
  @MinLength(16, {
    message: 'JWT_ACCESS_SECRET must be at least 16 chars (use a long random string in production)',
  })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(16, {
    message: 'JWT_REFRESH_SECRET must be at least 16 chars (use a long random string in production)',
  })
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @IsNumber()
  JWT_ACCESS_TTL: number = 900;

  @IsOptional()
  @IsNumber()
  JWT_REFRESH_TTL: number = 604800;

  @IsOptional()
  @IsString()
  CORS_ORIGINS: string = 'http://localhost:3000';

  @IsOptional()
  @IsNumber()
  RATE_LIMIT_PER_MIN: number = 120;

  @IsOptional()
  @IsString()
  AI_GATEWAY_BASE_URL = '';

  @IsOptional()
  @IsString()
  AI_GATEWAY_API_KEY = '';

  @IsOptional()
  @IsString()
  AI_MODEL_DEFAULT = 'gemini-flash';

  @IsOptional()
  @IsString()
  AI_MODEL_CONTENT = 'qwen-3';

  @IsOptional()
  @IsString()
  AI_MODEL_STRATEGY = 'claude-sonnet';

  @IsOptional()
  @IsString()
  INTEGRATION_ENC_KEY = '';
}

/** Decode a 32-byte key (base64 or 64-char hex). Returns byte length or -1 if invalid. */
function encKeyBytes(raw: string): number {
  if (!raw) return -1;
  const buf = raw.length === 64 ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  return buf.length;
}

export function validateEnv(config: Record<string, unknown>): EnvVars {
  const validated = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  // Production hardening: integration/token encryption must use a dedicated 32-byte
  // key, never the dev fallback that derives it from the JWT secret.
  if (validated.NODE_ENV === 'production') {
    const bytes = encKeyBytes(validated.INTEGRATION_ENC_KEY);
    if (bytes !== 32) {
      throw new Error(
        'INTEGRATION_ENC_KEY must be set to a 32-byte key (base64 or 64-hex) in production — generate with `openssl rand -base64 32`.',
      );
    }
    if (validated.JWT_ACCESS_SECRET === validated.JWT_REFRESH_SECRET) {
      throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ in production.');
    }
  }

  return validated;
}
