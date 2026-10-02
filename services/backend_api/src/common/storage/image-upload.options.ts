import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const ALLOWED_UPLOAD_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** Shared multipart constraints for every image upload route. */
export const IMAGE_UPLOAD_INTERCEPTOR_OPTIONS: MulterOptions = {
  limits: { files: 1, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_UPLOAD_MIME.has(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new BadRequestException('Only JPEG, PNG, WebP, or GIF images are allowed'), false);
    }
  },
};
