import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ConnectEmailDto {
  @IsString() smtp_host!: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) smtp_port?: number;
  @IsOptional() @IsBoolean() smtp_secure?: boolean;
  @IsString() smtp_user!: string;
  @IsString() smtp_password!: string;
  @IsEmail() from_email!: string;
  @IsOptional() @IsString() from_name?: string;
}

export class SendEmailDto {
  @IsEmail() to!: string;
  @IsString() subject!: string;
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsString() html?: string;
}

export class TestEmailDto {
  @IsOptional() @IsEmail() to?: string;
}
