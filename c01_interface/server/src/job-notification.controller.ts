import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { HsmGateway } from './hsm.gateway';

@Controller()
export class JobNotificationController {
  constructor(private readonly hsmGateway: HsmGateway) {}

  @MessagePattern('hsm.status.finished') 
  handleJobDone(@Payload() data: { jobId: string }) {
    console.log(`RabbitMQ Signal Received: Job ${data.jobId} is complete.`);
    
    this.hsmGateway.sendFinishedNotification(data.jobId);
  }
}
