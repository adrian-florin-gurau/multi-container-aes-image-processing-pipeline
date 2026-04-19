import { WebSocketGateway, WebSocketServer, OnGatewayInit } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ 
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  } 
})
export class HsmGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    console.log('WebSocket Gateway Initialized');
  }

  // We'll call this from a Controller instead of using @MessagePattern here
  sendFinishedNotification(jobId: string) {
    console.log(`Pushing 'jobFinished' for ${jobId} to client`);
    this.server.emit('jobFinished', { jobId });
  }
}