import {
  AccessTokenGuard,
  CustomValidationPipe,
  GlobalExceptionsFilter,
  TokenRepository,
} from '@app/shared';
import { SocketIoAdapter } from '@app/shared/adapters/socket-io.adapter';
import { GlobalInterceptor } from '@app/shared/interceptor/global-interceptor.interceptor';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import 'reflect-metadata';
import { ClientApiModule } from './client-api.module';
import { SwaggerService } from './domains/swagger/swagger.service';

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

  app.useGlobalGuards(new AccessTokenGuard(tokenRepository, reflector));
  app.enableShutdownHooks();
  app.useWebSocketAdapter(new SocketIoAdapter(app));

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

  const swaggerSvc = app.get(SwaggerService);
  swaggerSvc.setSpec(document);
  // ----------------------------

  await app.listen(process.env.CLIENT_API_PORT ?? 3334); // Changed from 3000 to 3334 to avoid conflicts
}
bootstrap();
