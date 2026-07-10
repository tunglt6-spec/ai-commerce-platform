import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PASSWORD_RULE =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'username may contain letters, numbers, _ . - only',
  })
  username!: string;

  @IsString()
  @Matches(PASSWORD_RULE, {
    message:
      'password must be at least 8 chars with 1 uppercase, 1 number and 1 special character',
  })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  first_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  last_name?: string;

  /** Optional name for the tenant/store created on registration. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tenant_name?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  /** Optionally select which tenant to authenticate against. */
  @IsOptional()
  @IsUUID()
  tenant_id?: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refresh_token!: string;
}
