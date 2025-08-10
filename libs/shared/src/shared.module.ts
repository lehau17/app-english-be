import { Global, Module } from '@nestjs/common';
import { TokenRepository } from './repositories';
@Global()
@Module({
    providers: [TokenRepository],
    exports: [TokenRepository],
})
export class SharedModule { }
