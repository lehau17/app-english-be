import { Module } from '@nestjs/common';
import { RoomController } from './controller/room.controller';
import { RoomRepository } from './repository/room.repository';
import { RoomService } from './service/room.service';

@Module({
  controllers: [RoomController],
  providers: [RoomService, RoomRepository],
})
export class RoomModule {}
