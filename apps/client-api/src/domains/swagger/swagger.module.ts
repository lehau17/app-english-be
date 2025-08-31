import { Module } from '@nestjs/common';
import { SwaggerService } from './swagger.service';

@Module({
  providers: [SwaggerService],
  exports: [SwaggerService],
})
export class SwaggerLoaderModule{}




//   implements OnModuleInit {
//   constructor(private readonly swagger: SwaggerService) {}
//   async onModuleInit() {
//     await this.swagger.loadSpec();
//   }
// }
