import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import 'dotenv/config';
import { AppConfig } from './common/interfaces/config-service.interface';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService: ConfigService<AppConfig> = app.get(ConfigService);
  const isDev: boolean =
    configService.get<string>('NODE_ENV') === 'development';

  app.enableCors({
    origin: isDev ? '*' : process.env.ALLOWED_ORIGIN, // En dev on accepte tout
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

  const config: Omit<OpenAPIObject, 'paths'> = new DocumentBuilder()
    .setTitle('Kilterboard API')
    .setDescription('API for the Kilterboard climbing app')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document: OpenAPIObject = SwaggerModule.createDocument(app, config);
  if (isDev) {
    SwaggerModule.setup('api', app, document);
  }

  await app.listen(configService.get<number>('PORT') ?? 3000);
}
void bootstrap();
