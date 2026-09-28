import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import * as path from 'node:path';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { createAppLogger } from './common/logging/winston.config';
import { requestContextMiddleware } from './common/logging/request-context';
import { getAllowedOrigins } from './common/config/env';

async function bootstrap() {
  const logger = createAppLogger();

  // Error monitoring activates only when a DSN is configured
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0,
    });
    logger.log('Sentry error monitoring initialized', 'Bootstrap');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger({ instance: logger }),
  });

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(requestContextMiddleware);

  // Uploaded media (local storage driver) is served at /uploads
  app.useStaticAssets(path.resolve(process.env.UPLOAD_DIR || './uploads'), {
    prefix: '/uploads',
  });

  const allowedOrigins = getAllowedOrigins();
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const globalPrefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(globalPrefix);

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(logger, Sentry));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('DeliveryOS Core REST API')
      .setDescription('Enterprise Backend API documentation for DeliveryOS platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  app.enableShutdownHooks();

  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.log(`DeliveryOS API Gateway running on: http://localhost:${port}/${globalPrefix}`, 'Bootstrap');
}

bootstrap();
