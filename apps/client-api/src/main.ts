import { NestFactory } from '@nestjs/core';
import { ClientApiModule } from './client-api.module';
import { CustomValidationPipe } from '@app/shared';

async function bootstrap() {
    const app = await NestFactory.create(ClientApiModule);
    app.useGlobalPipes(new CustomValidationPipe());
    await app.listen(process.env.port ?? 3000);
}
bootstrap();
