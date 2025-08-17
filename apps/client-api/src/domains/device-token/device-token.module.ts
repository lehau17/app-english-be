import { Module } from '@nestjs/common';
import { PrivateDeviceTokenController } from './controller';
import { DeviceTokenService } from './service';
import { DeviceTokenRepository } from './repository';

@Module({
  controllers: [PrivateDeviceTokenController],
  providers: [DeviceTokenService, DeviceTokenRepository],
})
export class DeviceTokenModule {}
