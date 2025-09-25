// private-auth.controller.ts
import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ChangePasswordDto, UpdateProfileDto } from '../dto';
import { AuthService } from '../service/auth.service';

@ApiTags('Auth (Private)')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/auth')
export class PrivateAuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user info' })
  @ApiOkResponse({ description: 'User info fetched successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage('User info fetched successfully')
  async me(@PayloadToken() tokenPayload: JwtPayload) {
    return this.authService.me(tokenPayload.sub);
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Change password (authenticated user)' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiOkResponse({ description: 'Password changed successfully' })
  @ApiBadRequestResponse({
    description: 'Current password invalid or payload invalid',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage('Password changed successfully')
  async changePassword(
    @PayloadToken() tokenPayload: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    const userId: string = tokenPayload.sub;
    return this.authService.changePassword(userId, dto);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update profile (authenticated user)' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiOkResponse({ description: 'Profile updated successfully' })
  @ResponseMessage('Profile updated successfully')
  async updateProfile(
    @PayloadToken() tokenPayload: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    const userId: string = tokenPayload.sub;
    return this.authService.updateProfile(userId, dto);
  }

}
