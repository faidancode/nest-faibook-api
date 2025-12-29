console.log('BOOTSTRAP STARTED');
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/http/exception.filter';
import { ResponseEnvelopeInterceptor } from './common/http/response.interceptor';
import { LoggingInterceptor } from './common/http/logging.interceptor';
import { AppConfig } from './config/app.config';
import helmet from 'helmet';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RequestIdInterceptor } from './common/http/request-id.interceptor';

const cookieParser = require('cookie-parser');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const appConfig = app.get(AppConfig);
  const logger = new Logger('Bootstrap');

  // Security
  app.use(helmet());
  app.disable('x-powered-by');
  app.use(cookieParser());
  // CORS
  console.log('Config Cors');
  const cors = appConfig.cors;
  app.enableCors({
    origin:
      cors.origins.length === 1 && cors.origins[0] === '*'
        ? true
        : cors.origins,
    credentials: cors.credentials,
  });

  // Global filters & interceptors
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    app.get(RequestIdInterceptor),
    app.get(LoggingInterceptor),
    new ResponseEnvelopeInterceptor(),
  );

  if (appConfig.enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('FAIBook API')
      .setDescription('API documentation for FAIBook services')
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'JWT-access',
      )
      .build();

    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, swaggerDocument, {
      swaggerOptions: { persistAuthorization: true },
    });

    logger.log('Swagger docs available at /docs');
  }

  app.enableShutdownHooks();

  const port = appConfig.port;
  await app.listen(port);
  logger.log(`Server running on http://localhost:${port}`);
}

bootstrap();
