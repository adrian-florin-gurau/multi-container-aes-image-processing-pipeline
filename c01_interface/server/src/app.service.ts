import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { lastValueFrom, timeout } from 'rxjs';

@Injectable()
export class AppService {
  private client: ClientProxy;

  constructor() {
    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://c02_broker:5672'],
        queue: 'hsm_pipeline_queue',
        queueOptions: { durable: true },
        socketOptions: {
          exchange: 'hsm_topic_exchange',
          exchangeType: 'topic',
        },
      },
    });
  }

  async dispatchToPipeline(file: Express.Multer.File, metadata: any) {
    const { key, iv, mode, action } = metadata;
    const jobId = `job_${Date.now()}`;

    // Prepare the payload
    const payload = {
      jobId,
      action,
      mode,
      key,
      iv: mode !== 'ECB' ? iv : null,
      fileBuffer: file.buffer.toString('base64'),
    };

    // Emit to RabbitMQ
    try {
      await this.client.connect();
      const publisher = await this.client.emit('hsm.execute.aes', payload);
      await lastValueFrom(publisher.pipe(timeout(5000)));
    } catch (err) {
      throw new InternalServerErrorException('HSM Broker (C02) is offline.');
    }

    return { jobId, status: 'QUEUED' };
  }
}