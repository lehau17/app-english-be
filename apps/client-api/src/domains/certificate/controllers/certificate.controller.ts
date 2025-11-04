import {
  JwtPayload,
  PayloadToken,
  ResponseMessage,
  Roles,
  RolesGuard,
} from '@app/shared';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IssueCertificateDto } from '../dto';
import { IssuedCertificateService } from '../services';

@ApiTags('Certificates')
@Controller('/private/v1/certificates')
export class CertificateController {
  constructor(private readonly certificateService: IssuedCertificateService) {}

  // ==================== ADMIN/TEACHER ENDPOINTS ====================

  @Post('/issue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.teacher)
  @ApiBearerAuth('Authorization')
  @ApiOperation({ summary: 'Issue certificate to a student (Admin/Teacher)' })
  @ApiResponse({ status: 201, description: 'Certificate issued successfully' })
  @ResponseMessage('Certificate issued successfully')
  async issueCertificate(@Body() dto: IssueCertificateDto) {
    return this.certificateService.issueCertificate(dto);
  }

  @Get('/admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.teacher)
  @ApiBearerAuth('Authorization')
  @ApiOperation({ summary: 'Get all certificates (Admin)' })
  @ApiResponse({ status: 200, description: 'Certificates retrieved' })
  @ResponseMessage('Certificates retrieved successfully')
  async getAllCertificates(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('includeRevoked') includeRevoked?: string,
    @Query('studentId') studentId?: string,
    @Query('courseId') courseId?: string,
  ) {
    return this.certificateService.getAllCertificates({
      skip: skip ? +skip : undefined,
      take: take ? +take : undefined,
      includeRevoked: includeRevoked === 'true',
      studentId,
      courseId,
    });
  }

  @Get('/courses/:courseId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.teacher, UserRole.content_creator)
  @ApiBearerAuth('Authorization')
  @ApiOperation({ summary: 'Get certificates for a course' })
  @ApiResponse({ status: 200, description: 'Certificates retrieved' })
  @ResponseMessage('Certificates retrieved successfully')
  async getCertificatesByCourse(
    @Param('courseId') courseId: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('includeRevoked') includeRevoked?: string,
  ) {
    return this.certificateService.getCertificatesByCourse(courseId, {
      skip: skip ? +skip : undefined,
      take: take ? +take : undefined,
      includeRevoked: includeRevoked === 'true',
    });
  }

  @Post('/:id/revoke')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('Authorization')
  @ApiOperation({ summary: 'Revoke a certificate (Admin only)' })
  @ApiResponse({ status: 200, description: 'Certificate revoked' })
  @ResponseMessage('Certificate revoked successfully')
  async revokeCertificate(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.certificateService.revokeCertificate(id, reason);
  }

  // ==================== STUDENT ENDPOINTS ====================

  @Get('/my-certificates')
  @ApiBearerAuth('Authorization')
  @ApiOperation({ summary: 'Get my certificates (Student)' })
  @ApiResponse({ status: 200, description: 'Certificates retrieved' })
  @ResponseMessage('My certificates retrieved successfully')
  async getMyCertificates(
    @PayloadToken() payload: JwtPayload,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    return this.certificateService.getMyCertificates(payload.sub, {
      skip: skip ? +skip : undefined,
      take: take ? +take : undefined,
    });
  }

  @Get('/:id')
  @ApiBearerAuth('Authorization')
  @ApiOperation({ summary: 'Get certificate by ID' })
  @ApiResponse({ status: 200, description: 'Certificate found' })
  @ResponseMessage('Certificate retrieved successfully')
  async getCertificateById(@Param('id') id: string) {
    return this.certificateService.getCertificateById(id);
  }

  // ==================== PUBLIC ENDPOINTS ====================

  @Get('public/v1/verify/code/:verificationCode')
  @ApiOperation({ summary: 'Verify certificate by verification code (Public)' })
  @ApiResponse({ status: 200, description: 'Certificate verified' })
  @ResponseMessage('Certificate verified successfully')
  async verifyCertificate(@Param('verificationCode') verificationCode: string) {
    return this.certificateService.verifyCertificate(verificationCode);
  }

  @Get('public/v1/verify/number/:certificateNumber')
  @ApiOperation({
    summary: 'Verify certificate by certificate number (Public)',
  })
  @ApiResponse({ status: 200, description: 'Certificate verified' })
  @ResponseMessage('Certificate verified successfully')
  async verifyCertificateByNumber(
    @Param('certificateNumber') certificateNumber: string,
  ) {
    return this.certificateService.verifyCertificateByNumber(certificateNumber);
  }
}
