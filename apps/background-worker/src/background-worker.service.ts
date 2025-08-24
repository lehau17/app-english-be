import { Injectable } from '@nestjs/common';

@Injectable()
export class BackgroundWorkerService {
  getHello(): string {
    return 'Hello World!';
  }
}
