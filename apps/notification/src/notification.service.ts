import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendEmail(params: {
    subject: string;
    template: string;
    context: ISendMailOptions['context'];
  }) {
    try {
      const emailsList: string[] = process.env.SMTP_TO?.split(',');

      if (!emailsList) {
        throw new BadRequestException(
          `No recipients found in SMTP_TO env var, please check your .env file`,
        );
      }

      const sendMailParams = {
        to: emailsList,
        from: process.env.SMTP_FROM,
        subject: params.subject,
        template: params.template,
        context: params.context,
      };
      const response = await this.mailerService.sendMail(sendMailParams);
      this.logger.log(
        `Email sent successfully to recipients with the following parameters : ${JSON.stringify(
          sendMailParams,
        )}`,
        response,
      );
    } catch (error) {
      this.logger.error(
        `Error while sending mail with the following parameters : ${JSON.stringify(
          params,
        )}`,
        error,
      );
    }
  }
}
