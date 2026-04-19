import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Critical for the Next.js Client to talk to this API
  app.enableCors({
    origin: 'http://localhost:3000',
    methods: 'POST',
    allowedHeaders: 'Content-Type, Accept',
  });

  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://c02_broker:5672'],
      queue: 'hsm_status_queue', // Java will send 'finished' messages here
    },
  });

  await app.startAllMicroservices();
  await app.listen(3001);
  console.log('HSM Gateway is live on port 3001');
}
bootstrap();
