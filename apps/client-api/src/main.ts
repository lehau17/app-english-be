import { AccessTokenGuard, CustomValidationPipe, GlobalExceptionsFilter, TokenRepository } from '@app/shared';
import { GlobalInterceptor } from '@app/shared/interceptor/global-interceptor.interceptor';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ClientApiModule } from './client-api.module';

async function bootstrap() {
    const app = await NestFactory.create(ClientApiModule);
    const reflector = app.get(Reflector);
    const tokenRepository = app.get(TokenRepository);

    // Global setup
    app.useGlobalPipes(new CustomValidationPipe());
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });
    app.useGlobalFilters(new GlobalExceptionsFilter());
    app.useGlobalInterceptors(new GlobalInterceptor(reflector));
    app.setGlobalPrefix('api');


    app.useGlobalGuards(new AccessTokenGuard(tokenRepository, reflector))
    app.enableShutdownHooks();

    // ---------- Swagger ----------
    const config = new DocumentBuilder()
        .setTitle('Client API')
        .setDescription('English Learning – Public Client API')
        .setVersion('1.0.0')
        .addBearerAuth(
            { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            'Authorization',
        ) // tên security scheme: Authorization
        .addServer('http://localhost:3000', 'Local')
        .build();

    const document = SwaggerModule.createDocument(app, config, {
        deepScanRoutes: true, // scan cả module import sâu
    });

    // UI ở /api/docs, file JSON ở /api/docs-json
    SwaggerModule.setup('api/docs', app, document, {
        jsonDocumentUrl: 'api/docs-json',
        customSiteTitle: 'Client API Docs',
        swaggerOptions: {
            persistAuthorization: true, // giữ lại bearer token khi reload
            displayRequestDuration: true,
        },
    });
    // ----------------------------

    await app.listen(process.env.PORT ?? 3000); // nên dùng PORT (chữ hoa)
}
bootstrap();
