import { PageResponseDto } from '@app/shared/payload/response/page-response.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DeviceToken } from '@prisma/client';
import {
  CreateDeviceTokenDto,
  FilterDeviceTokenRequestDto,
  UpdateDeviceTokenDto,
} from '../dto/device-token.dto';
import { DeviceTokenRepository } from '../repository/device-token.repository';

@Injectable()
export class DeviceTokenService {
  constructor(private readonly deviceTokenRepository: DeviceTokenRepository) {}

  async create(dto: CreateDeviceTokenDto): Promise<DeviceToken> {
    return this.deviceTokenRepository.create(dto);
  }

  async findById(id: string): Promise<DeviceToken> {
    const deviceToken = await this.deviceTokenRepository.findById(id);
    if (!deviceToken) {
      throw new NotFoundException(`DeviceToken with id ${id} not found`);
    }
    return deviceToken;
  }

  async update(id: string, dto: UpdateDeviceTokenDto): Promise<DeviceToken> {
    await this.ensureExists(id);
    return this.deviceTokenRepository.update(id, dto);
  }

  async delete(id: string): Promise<DeviceToken> {
    await this.ensureExists(id);
    return this.deviceTokenRepository.delete(id);
  }

  async list(
    params: FilterDeviceTokenRequestDto,
  ): Promise<PageResponseDto<DeviceToken>> {
    return this.deviceTokenRepository.list(params);
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.deviceTokenRepository.findById(id);
    if (!exists) {
      throw new NotFoundException(`DeviceToken with id ${id} not found`);
    }
  }
}
