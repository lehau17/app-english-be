// private-auth.controller.ts
import { JwtPayload, PayloadToken, ResponseMessage } from '@app/shared';
import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from '../dto';
import { AuthService } from '../service/auth.service';

@ApiTags('Auth (Private)')
@ApiBearerAuth('Authorization')
@Controller('/private/v1/auth')
export class PrivateAuthController {
  constructor(private readonly authService: AuthService) {}

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

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset (send email with token)' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOkResponse({ description: 'Reset email sent (stub: returns true)' })
  @ResponseMessage('Reset email sent')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    // Gửi email: hiện tại chỉ return true theo yêu cầu
    // Bạn có thể implement queue/mail sau này
    return this.authService.forgotPassword(dto); // hoặc `return true;` nếu chưa có service
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password by token (from email)' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({ description: 'Password reset successfully (stub OK)' })
  @ApiBadRequestResponse({ description: 'Invalid or expired reset token' })
  @ResponseMessage('Password reset successfully')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto); // tạm thời có thể return true bên service
  }
}
