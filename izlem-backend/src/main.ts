import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get configuration service
  const configService = app.get(ConfigService);

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // Global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(`🚀 İzlem Backend is running on: http://localhost:${port}/api`);
  console.log(
    `📊 Environment: ${configService.get('NODE_ENV', 'development')}`,
  );
}

bootstrap();
