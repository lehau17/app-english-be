import { CustomValidationPipe, GlobalExceptionsFilter } from '@app/shared';
import { GlobalInterceptor } from '@app/shared/interceptor/global-interceptor.interceptor';
import { NestFactory, Reflector } from '@nestjs/core';
import { ClientApiModule } from './client-api.module';

async function bootstrap() {
    const app = await NestFactory.create(ClientApiModule);
    app.useGlobalPipes(new CustomValidationPipe());
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });
    app.useGlobalFilters(new GlobalExceptionsFilter())
    app.useGlobalInterceptors(new GlobalInterceptor(new Reflector()))
    app.setGlobalPrefix('api');
    app.enableShutdownHooks();

    await app.listen(process.env.port ?? 3000);
}
bootstrap();
