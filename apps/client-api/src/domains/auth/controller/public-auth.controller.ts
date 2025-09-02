// auth.controller.ts
import { ResponseMessage } from '@app/shared';
import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LoginDto, LogoutDto, RefreshTokenDto, RegisterDto } from '../dto';
import { AuthService } from '../service/auth.service';

@ApiTags('Auth')
@Controller('/public/v1/auth')
export class PublicAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('student-register')
  @ApiOperation({ summary: 'Register a new account' })
  @ApiBody({ type: RegisterDto })
  @ApiBadRequestResponse({
    description: 'Email/Phone/Username already exists or invalid payload',
  })
  @ResponseMessage('Register successful')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('student-login')
  @ApiOperation({ summary: 'Login with email/phone/username and password' })
  @ApiBody({ type: LoginDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ResponseMessage('Login successful')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh-token')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token invalid or expired' })
  @ResponseMessage('Token refreshed successfully')
  async refreshToken(@Body() payload: RefreshTokenDto) {
    return this.authService.refreshToken(payload);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiBody({ type: LogoutDto })
  @ApiOkResponse({ description: 'Logout successful' })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  @ResponseMessage('Logout successful')
  async logout(@Body() payload: LogoutDto) {
    return this.authService.logout(payload);
  }

  @Post('admin-login')
  async adminLogin(@Body() dto: LoginDto) {
    return this.authService.adminLogin(dto);
  }

  @Post('admin-register')
  async adminRegister(@Body() dto: RegisterDto) {
    return this.authService.adminRegister(dto);
  }
}
