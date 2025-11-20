import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendPasswordResetEmail(params: {
    to: string;
    name: string;
    token: string;
    resetLink: string;
    expiresAt: string;
  }) {
    try {
      const sendMailParams: ISendMailOptions = {
        to: params.to,
        from: process.env.SMTP_FROM || 'noreply@english-learning.com',
        subject: 'Đặt lại mật khẩu - English Learning',
        template: './password-reset',
        context: {
          name: params.name,
          token: params.token,
          resetLink: params.resetLink,
          expiresAt: new Date(params.expiresAt).toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            dateStyle: 'full',
            timeStyle: 'medium',
          }),
        },
      };

      const response = await this.mailerService.sendMail(sendMailParams);
      this.logger.log(
        `✅ Password reset email sent successfully to ${params.to}`,
      );
      return response;
    } catch (error) {
      this.logger.error(
        `❌ Error sending password reset email to ${params.to}:`,
        error,
      );
      throw error;
    }
  }
}


