import { NestFactory } from '@nestjs/core';
import { ClientApiModule } from './client-api.module';

async function bootstrap() {
  const app = await NestFactory.create(ClientApiModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
