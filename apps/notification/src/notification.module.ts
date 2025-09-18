import { MailerModule } from '@nestjs-modules/mailer';
import { PugAdapter } from '@nestjs-modules/mailer/dist/adapters/pug.adapter';
import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationConsumer } from './notification.consumer';
import { DatabaseModule } from '@app/database';
@Module({
  imports: [
    DatabaseModule,
    MailerModule.forRootAsync({
      useFactory: () => ({
        transport: {
          host: process.env.SMTP_HOST,
          port: +process.env.SMTP_PORT,
          secure: false,
          tls: {
            rejectUnauthorized: false,
          },
        },
        defaults: {
          from: process.env.FROM,
        },
        template: {
          dir: __dirname + '/../../templates',
          adapter: new PugAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
  ],
  controllers: [],
  providers: [NotificationService, NotificationConsumer],
})
export class NotificationModule {}
