import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

export const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
export const UPLOAD_URL_PREFIX = '/uploads';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB

const ALLOWED: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

export function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
}

/** Multer options: safe uuid filenames (no user input in path), mime allow-list, 100MB cap. */
export const multerOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      ensureUploadDir();
      cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      // Filename derived solely from a random uuid + allow-listed extension.
      const ext = ALLOWED[file.mimetype] || extname(file.originalname).replace(/[^.a-z0-9]/gi, '');
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (_req: any, file: any, cb: any) => {
    if (!ALLOWED[file.mimetype]) {
      return cb(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
    }
    cb(null, true);
  },
};

export function isImage(mime: string): boolean {
  return mime.startsWith('image/');
}
