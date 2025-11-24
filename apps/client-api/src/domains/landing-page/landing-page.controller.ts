import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
    GuestEnrollmentDto,
    GuestEnrollmentRole,
} from './dto/guest-enrollment.dto';
import { ContactFormPayload, LandingPageService } from './landing-page.service';

export class ContactFormDto implements ContactFormPayload {
  name: string;
  phone: string;
  email: string;
  level?: string;
  goals?: string[];
  message?: string;
}

@ApiTags('Landing Page')
@Controller('/public/v1/landing-page')
export class LandingPageController {
  constructor(private readonly landingPageService: LandingPageService) {}

  @Get()
  @ApiOperation({ summary: 'Get landing page data' })
  @ApiResponse({
    status: 200,
    description: 'Landing page data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        features: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              icon: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
        stats: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              number: { type: 'string' },
              label: { type: 'string' },
            },
          },
        },
        testimonials: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              author: { type: 'string' },
              role: { type: 'string' },
              avatar: { type: 'string' },
            },
          },
        },
        classes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              level: { type: 'string' },
              levelVi: { type: 'string' },
              color: { type: 'string' },
              bgColor: { type: 'string' },
              borderColor: { type: 'string' },
              description: { type: 'string' },
              duration: { type: 'string' },
              schedule: { type: 'string' },
              students: { type: 'string' },
              teacher: { type: 'string' },
              teacherFlag: { type: 'string' },
              price: { type: 'string' },
              features: { type: 'array', items: { type: 'string' } },
              nextClass: { type: 'string' },
            },
          },
        },
        footerSections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              links: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
  })
  async getLandingPageData() {
    return await this.landingPageService.getLandingPageData();
  }

  @Post('contact')
  @ApiOperation({ summary: 'Submit contact form' })
  @ApiResponse({
    status: 201,
    description: 'Contact form submitted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async submitContactForm(@Body() contactFormDto: ContactFormDto) {
    return await this.landingPageService.submitContactForm(contactFormDto);
  }

  @Post('validate-guest-user')
  @ApiOperation({
    summary: 'Kiểm tra email/phone đã tồn tại trước khi đăng ký',
    description: 'Validate email và phone của học sinh/phụ huynh có bị trùng không',
  })
  @ApiResponse({
    status: 200,
    description: 'Thông tin hợp lệ',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Thông tin hợp lệ' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Email hoặc số điện thoại đã được sử dụng',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Email hoặc số điện thoại đã được sử dụng' },
        conflicts: {
          type: 'object',
          properties: {
            students: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  index: { type: 'number' },
                  email: { type: 'boolean' },
                  phone: { type: 'boolean' },
                },
              },
            },
            parent: {
              type: 'object',
              properties: {
                email: { type: 'boolean' },
                phone: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  })
  async validateGuestUser(@Body() payload: GuestEnrollmentDto) {
    return this.landingPageService.validateGuestUser(payload);
  }

  @Post('guest-enrollment')
  @ApiOperation({
    summary: 'Đăng ký khóa học từ landing page (khách vãng lai)',
    description:
      'Cho phép khách chọn đăng ký với tư cách học viên hoặc phụ huynh, tự động tạo tài khoản và sinh link VNPay.',
  })
  @ApiResponse({
    status: 201,
    description: 'Khởi tạo đăng ký thành công',
    schema: {
      type: 'object',
      properties: {
        paymentUrl: { type: 'string' },
        transactionId: { type: 'string' },
        studentId: { type: 'string' },
        parentId: { type: 'string', nullable: true },
        role: { type: 'string', enum: Object.values(GuestEnrollmentRole) },
        message: { type: 'string' },
      },
    },
  })
  async createGuestEnrollment(
    @Body() payload: GuestEnrollmentDto,
    @Req() req: Request,
  ) {
    const ipAddress =
      req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';
    return this.landingPageService.createGuestEnrollment(payload, ipAddress);
  }
}
