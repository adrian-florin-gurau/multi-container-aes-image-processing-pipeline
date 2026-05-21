import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    allowedHeaders: 'Content-Type, Accept',
  });

  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://guest:guest@c02_broker:5672'],
      queue: 'hsm_status_queue',
    },
  });

  await app.startAllMicroservices();
  await app.listen(3001, '0.0.0.0');
  console.log('HSM Gateway is live on port 3001');
}
bootstrap();
