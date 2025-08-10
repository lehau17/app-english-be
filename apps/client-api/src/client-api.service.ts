import { Injectable } from '@nestjs/common';

@Injectable()
export class ClientApiService {
  getHello(): string {
    return 'Hello World!';
  }
}
