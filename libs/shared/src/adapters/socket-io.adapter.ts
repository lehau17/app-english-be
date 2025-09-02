import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { INestApplication } from '@nestjs/common';

export class SocketIoAdapter extends IoAdapter {
  constructor(private readonly app: INestApplication) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    // Add your custom logic here, e.g., authentication middleware
    return server;
  }
}
