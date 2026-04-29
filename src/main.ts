/**
 * Punto de entrada de la aplicación NestJS.
 * Arranca el servidor, configura validación global, prefijo de API
 * y documentación Swagger.
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar body parser para formularios HTML (reset password)
  app.use(urlencoded({ extended: true }));

  // Habilitar CORS para la web de administración
  app.enableCors();

  // Todas las rutas empezarán por /api/v1
  app.setGlobalPrefix('api/v1');

  // Validación global de DTOs:
  // - whitelist: elimina propiedades no declaradas en el DTO
  // - forbidNonWhitelisted: lanza error si llegan propiedades desconocidas
  // - transform: convierte payloads al tipo del DTO (necesario para @Transform)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Configuración de Swagger para documentación interactiva en /api
  const config = new DocumentBuilder()
    .setTitle('INCIDENTS RESTFUL API')
    .setDescription('Martos incidents endpoints')
    .setVersion('1.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  // Puerto configurable por variable de entorno (Render lo define automáticamente)
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
