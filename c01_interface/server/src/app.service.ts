import { Injectable, InternalServerErrorException } from '@nestjs/common';

const amqp = require('amqplib');

@Injectable()
export class AppService {
  private readonly rabbitUrl =
    process.env.RABBITMQ_URL || 'amqp://guest:guest@c02_broker:5672';

  async dispatchToPipeline(file: Express.Multer.File, metadata: any) {
    const { key, iv, mode, action } = metadata;
    const jobId = `job_${Date.now()}`;

    const payload = {
      jobId,
      action,
      mode,
      key,
      iv: mode !== 'ECB' ? iv : null,
      fileBuffer: file.buffer.toString('base64'),
    };

    let connection: any;
    let channel: any;

    try {
      connection = await amqp.connect(this.rabbitUrl);
      channel = await connection.createChannel();

      await channel.assertExchange('hsm_topic_exchange', 'topic', {
        durable: true,
      });
      await channel.assertQueue('hsm_pipeline_queue', { durable: true });
      await channel.bindQueue(
        'hsm_pipeline_queue',
        'hsm_topic_exchange',
        'hsm.execute.#',
      );

      const published = channel.publish(
        'hsm_topic_exchange',
        'hsm.execute.aes',
        Buffer.from(JSON.stringify(payload)),
        {
          contentType: 'application/json',
          persistent: true,
        },
      );

      if (!published) {
        throw new Error('RabbitMQ publish buffer is full.');
      }
    } catch (err) {
      throw new InternalServerErrorException('HSM Broker (C02) is offline.');
    } finally {
      if (channel) {
        await channel.close();
      }
      if (connection) {
        await connection.close();
      }
    }

    return { jobId, status: 'QUEUED' };
  }
}
