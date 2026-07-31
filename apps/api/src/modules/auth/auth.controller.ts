import {
  Body,
  Controller,
  Get,
  Ip,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import {
  AUTH_RATE_LIMIT,
  AUTH_RATE_LIMIT_TTL_MS,
  DEVICE_MAX_LENGTH,
} from './auth.constants';
import { AuthService, type RequestContext } from './auth.service';
import { SessionGuard } from './guards/session.guard';
import type { AuthResult, RefreshResult } from './dto/auth-response.dto';
import { toUserResponse, UserResponse } from './dto/auth-response.dto';
import type { LoginDto } from './dto/login.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({
    default: { limit: AUTH_RATE_LIMIT, ttl: AUTH_RATE_LIMIT_TTL_MS },
  })
  @ApiOperation({ summary: 'Register a new account' })
  register(
    @Body() dto: RegisterDto,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<AuthResult> {
    return this.authService.register(dto, this.toRequestContext(req, ip));
  }

  @Public()
  @Post('login')
  @Throttle({
    default: { limit: AUTH_RATE_LIMIT, ttl: AUTH_RATE_LIMIT_TTL_MS },
  })
  @ApiOperation({ summary: 'Authenticate and obtain tokens' })
  login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<AuthResult> {
    return this.authService.login(dto, this.toRequestContext(req, ip));
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate the refresh token' })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<RefreshResult> {
    return this.authService.refresh(
      dto.refreshToken,
      this.toRequestContext(req, ip),
    );
  }

  @UseGuards(SessionGuard)
  @Post('logout')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke the current session' })
  logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.authService.logout(user);
  }

  @UseGuards(SessionGuard)
  @Get('me')
  @Roles('USER', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the current user profile' })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponse> {
    const profile = await this.authService.me(user);
    return toUserResponse(profile);
  }

  private toRequestContext(req: Request, ip: string): RequestContext {
    const device = req.get('user-agent');
    return {
      ip: ip === '::1' ? '127.0.0.1' : ip,
      device:
        device !== undefined && device.length > DEVICE_MAX_LENGTH
          ? device.slice(0, DEVICE_MAX_LENGTH)
          : device,
    };
  }
}
