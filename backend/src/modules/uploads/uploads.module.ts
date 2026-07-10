import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { ensureUploadDir } from './uploads.config';

@Module({
  controllers: [UploadsController],
})
export class UploadsModule {
  constructor() {
    ensureUploadDir();
  }
}
