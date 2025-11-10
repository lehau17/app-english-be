import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
              popular: { type: 'boolean', required: false },
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
}
