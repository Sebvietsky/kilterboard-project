import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import 'dotenv/config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService: ConfigService<unknown, boolean> = app.get(ConfigService);
  const isDev: boolean =
    configService.get<string>('NODE_ENV') === 'development';

  app.enableCors({
    origin:
      process.env.NODE_ENV === 'development' ? '*' : process.env.ALLOWED_ORIGIN, // En dev on accepte tout
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalFilters(new PrismaExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      enableDebugMessages: isDev,
    }),
  );
  await app.listen(configService.get<number>('PORT') ?? 3000);
}
void bootstrap();
