import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
  GuestEnrollmentDto,
  GuestEnrollmentRole,
} from './dto/guest-enrollment.dto';
import { VerifyEnrollmentEmailDto } from './dto/verify-enrollment-email.dto';
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

  @Post('verify-enrollment-email')
  @ApiOperation({
    summary: '🆕 FLOW MỚI - Step 1: Verify email và gửi verification link',
    description:
      'Kiểm tra email conflicts và gửi email xác thực với JWT token (30 phút). User click link trong email để tiếp tục thanh toán.',
  })
  @ApiResponse({
    status: 201,
    description: 'Email xác thực đã được gửi thành công',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example:
            'Email xác thực đã được gửi. Vui lòng kiểm tra hộp thư và click vào link để tiếp tục thanh toán.',
        },
        email: { type: 'string', example: 'student@example.com' },
        expiresIn: { type: 'number', example: 1800, description: 'Seconds' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Email hoặc phone đã tồn tại trong hệ thống',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'ACCOUNT_EXISTS' },
        message: {
          type: 'string',
          example: 'Email hoặc số điện thoại đã có tài khoản trong hệ thống.',
        },
        action: { type: 'string', example: 'LOGIN_REQUIRED' },
        loginUrl: { type: 'string' },
        hint: { type: 'string' },
      },
    },
  })
  async verifyEnrollmentEmail(@Body() payload: VerifyEnrollmentEmailDto) {
    return this.landingPageService.verifyEnrollmentEmail(payload);
  }

  @Post('payment')
  @ApiOperation({
    summary: '🆕 FLOW MỚI - Step 2: Tạo payment từ verified token',
    description:
      'Nhận JWT token từ email verification link, verify token và tạo VNPay payment URL. User sẽ được redirect đến VNPay.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment URL được tạo thành công',
    schema: {
      type: 'object',
      properties: {
        paymentUrl: {
          type: 'string',
          example: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...',
        },
        transactionId: { type: 'string', example: 'txn_abc123' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Token không hợp lệ hoặc đã hết hạn',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'TOKEN_EXPIRED' },
        message: {
          type: 'string',
          example: 'Link xác thực đã hết hạn. Vui lòng đăng ký lại.',
        },
      },
    },
  })
  async createPaymentWithToken(
    @Body('token') token: string,
    @Body('returnUrl') returnUrl?: string,
    @Req() req?: Request,
  ) {
    const ipAddress =
      req?.ip || req?.headers['x-forwarded-for']?.toString() || '127.0.0.1';
    return this.landingPageService.createPaymentWithToken(
      token,
      returnUrl,
      ipAddress,
    );
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
