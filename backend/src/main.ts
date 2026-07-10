import 'reflect-metadata';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaService } from './common/prisma/prisma.service';
import { UPLOAD_DIR, UPLOAD_URL_PREFIX, ensureUploadDir } from './modules/uploads/uploads.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.setGlobalPrefix('api/v1');

  // Serve uploaded media (local storage; use S3/CDN in production).
  ensureUploadDir();
  app.useStaticAssets(UPLOAD_DIR, { prefix: UPLOAD_URL_PREFIX });
  app.enableCors({
    origin: config.get<string[]>('corsOrigins'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);
  app.enableShutdownHooks();

  const port = config.get<number>('port') ?? 3001;
  await app.listen(port, '0.0.0.0');
  logger.log(`AI Commerce backend listening on http://0.0.0.0:${port}/api/v1`);
}

bootstrap();
