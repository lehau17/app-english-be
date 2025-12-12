import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { IssuedCertificateService } from '../services';

@ApiTags('Public Certificates')
@Controller('/public/v1/certificates')
export class PublicCertificateController {
  constructor(private readonly certificateService: IssuedCertificateService) {}

  @Get('/share/:verificationCode')
  @UseGuards(RateLimitGuard)
  @ApiOperation({
    summary: 'Get public certificate share view (Public)',
    description:
      'View certificate in HTML format using verification code. No authentication required. Rate limited: 100 requests per minute per IP.',
  })
  @ApiResponse({ status: 200, description: 'Certificate HTML view' })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getPublicCertificateShare(
    @Param('verificationCode') verificationCode: string,
    @Res() res: Response,
  ) {
    const html =
      await this.certificateService.getPublicCertificateShare(verificationCode);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('/share/:verificationCode/download')
  @UseGuards(RateLimitGuard)
  @ApiOperation({
    summary: 'Download certificate PDF (Public)',
    description:
      'Download certificate as PDF file using verification code. No authentication required. Rate limited: 10 downloads per minute per IP.',
  })
  @ApiResponse({ status: 200, description: 'Certificate PDF file' })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async downloadPublicCertificate(
    @Param('verificationCode') verificationCode: string,
    @Res() res: Response,
  ) {
    const pdfBuffer =
      await this.certificateService.getPublicCertificatePDF(verificationCode);
    const certificate =
      await this.certificateService.verifyCertificate(verificationCode);

    // Sanitize filename for Content-Disposition header
    const sanitizedFilename = `certificate-${certificate.certificateNumber}.pdf`
      .replace(/[^\w\s.-]/g, '')
      .trim();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${sanitizedFilename}"`,
    );
    res.send(pdfBuffer);
  }

  @Get('/verify/code/:verificationCode')
  @ApiOperation({
    summary: 'Verify certificate by verification code (Public)',
    description: 'Verify certificate metadata using verification code.',
  })
  @ApiResponse({ status: 200, description: 'Certificate verified' })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  async verifyCertificate(@Param('verificationCode') verificationCode: string) {
    return this.certificateService.verifyCertificate(verificationCode);
  }

  @Get('/verify/number/:certificateNumber')
  @ApiOperation({
    summary: 'Verify certificate by certificate number (Public)',
    description: 'Verify certificate metadata using certificate number.',
  })
  @ApiResponse({ status: 200, description: 'Certificate verified' })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  async verifyCertificateByNumber(
    @Param('certificateNumber') certificateNumber: string,
  ) {
    return this.certificateService.verifyCertificateByNumber(certificateNumber);
  }
}



