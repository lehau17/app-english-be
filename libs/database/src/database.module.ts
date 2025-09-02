import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaRepository } from './prisma.repository';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [PrismaRepository],
  exports: [PrismaRepository],
})
export class DatabaseModule {}
