import { Controller, Get } from '@nestjs/common';
import { ClientApiService } from './client-api.service';

@Controller()
export class ClientApiController {
  constructor(private readonly clientApiService: ClientApiService) {}

  @Get()
  getHello(): string {
    return this.clientApiService.getHello();
  }
}
