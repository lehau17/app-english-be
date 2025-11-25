import { DatabaseModule } from '@app/database';
import { SharedModule } from '@app/shared';
import { MailerModule } from '@nestjs-modules/mailer';
import { PugAdapter } from '@nestjs-modules/mailer/dist/adapters/pug.adapter';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AssignmentReminderService } from './assignment-reminder.service';
import { NotificationListener } from './notification.listener';
import { NotificationService } from './notification.service';

@Module({
  imports: [
    DatabaseModule,
    SharedModule,
    ScheduleModule.forRoot(),
    MailerModule.forRootAsync({
      useFactory: () => ({
        transport: {
          host: process.env.SMTP_HOST,
          port: +process.env.SMTP_PORT,
          secure: false,
          auth: {
        user: process.env.SMTP_USERNAME,   // username / email gửi
        pass: process.env.SMTP_PASSWORD,   // mật khẩu / app password
      },
          tls: {
            rejectUnauthorized: false,
          },
        },
        defaults: {
          from: "english@eduliagua.com",
        },
        template: {
          dir: __dirname + '/templates',
          adapter: new PugAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
  ],
  controllers: [],
  providers: [
    NotificationService,
    NotificationListener,
    AssignmentReminderService,
  ],
})
export class NotificationModule {}
