import { Injectable, NotFoundException } from '@nestjs/common';
import { RoomRepository } from '../repository/room.repository';
import { CreateRoomDto, UpdateRoomDto, FilterRoomRequestDto } from '../dto';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Room } from '@prisma/client';

@Injectable()
export class RoomService {
  constructor(private readonly roomRepository: RoomRepository) {}

  async create(createRoomDto: CreateRoomDto): Promise<Room> {
    return this.roomRepository.create(createRoomDto);
  }

  async findAll(filter: FilterRoomRequestDto): Promise<PageResponseDto<Room>> {
    return this.roomRepository.list(filter);
  }

  async findOne(id: string): Promise<Room> {
    const room = await this.roomRepository.findById(id);
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }
    return room;
  }

  async update(id: string, updateRoomDto: UpdateRoomDto): Promise<Room> {
    await this.findOne(id); // Check if room exists
    return this.roomRepository.update(id, updateRoomDto);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // Check if room exists
    await this.roomRepository.delete(id);
  }
}
