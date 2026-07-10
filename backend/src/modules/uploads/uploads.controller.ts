import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles';
import { isImage, MAX_IMAGE_BYTES, multerOptions, UPLOAD_DIR, UPLOAD_URL_PREFIX } from './uploads.config';

@Controller('uploads')
export class UploadsController {
  @Post()
  @Roles(ROLES.OPERATOR)
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded (field name: file)');

    // Enforce the stricter per-type size limit (images 10MB).
    if (isImage(file.mimetype) && file.size > MAX_IMAGE_BYTES) {
      await unlink(join(UPLOAD_DIR, file.filename)).catch(() => undefined);
      throw new BadRequestException('Image exceeds 10MB limit');
    }

    return {
      success: true,
      data: {
        url: `${UPLOAD_URL_PREFIX}/${file.filename}`,
        filename: file.filename,
        mime: file.mimetype,
        size: file.size,
      },
    };
  }
}
