import { Body, Controller, Header, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/** Tight limits on unauthenticated credential endpoints to blunt brute-force / abuse. */
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const data = await this.authService.register(dto);
    return { success: true, data };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const data = await this.authService.login(dto);
    return { success: true, data };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('refresh')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto) {
    const data = await this.authService.refresh(dto);
    return { success: true, data };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('userId') userId: string) {
    const data = await this.authService.logout(userId);
    return { success: true, ...data };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    const data = await this.authService.changePassword(userId, dto.current_password, dto.new_password);
    return { success: true, ...data };
  }
}
