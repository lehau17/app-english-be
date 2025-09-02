import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { RoomService } from '../service/room.service';
import { CreateRoomDto, UpdateRoomDto, FilterRoomRequestDto } from '../dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Room } from '@prisma/client';
import { ResponseMessage } from '@app/shared/decorator/ResponseMessage.decorator';

@ApiTags('Rooms')
@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new room' })
  @ApiResponse({
    status: 201,
    description: 'The room has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ResponseMessage('Room created successfully')
  create(@Body() createRoomDto: CreateRoomDto): Promise<Room> {
    return this.roomService.create(createRoomDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get a list of rooms' })
  @ApiResponse({ status: 200, description: 'List of rooms.' })
  findAll(
    @Query() filter: FilterRoomRequestDto,
  ): Promise<PageResponseDto<Room>> {
    return this.roomService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a room by ID' })
  @ApiResponse({ status: 200, description: 'The room.' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  findOne(@Param('id') id: string): Promise<Room> {
    return this.roomService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a room' })
  @ApiResponse({
    status: 200,
    description: 'The room has been successfully updated.',
  })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  @ResponseMessage('Room updated successfully')
  update(
    @Param('id') id: string,
    @Body() updateRoomDto: UpdateRoomDto,
  ): Promise<Room> {
    return this.roomService.update(id, updateRoomDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a room' })
  @ApiResponse({
    status: 200,
    description: 'The room has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  @ResponseMessage('Room deleted successfully')
  async remove(@Param('id') id: string): Promise<void> {
    await this.roomService.remove(id);
  }
}
