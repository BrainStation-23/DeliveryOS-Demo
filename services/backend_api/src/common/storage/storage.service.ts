import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver = process.env.STORAGE_DRIVER || 'local';
  private readonly uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');

  /**
   * Persist an uploaded image and return its public URL. Local driver writes to
   * UPLOAD_DIR (served statically at /uploads); S3-compatible drivers are the
   * next increment and reject explicitly until implemented.
   */
  async saveImage(file: Express.Multer.File): Promise<{ url: string; driver: string }> {
    if (this.driver !== 'local') {
      throw new BadRequestException(`Storage driver "${this.driver}" is not supported yet; use "local"`);
    }

    if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, WebP, or GIF images are allowed');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Image exceeds the 5 MB size limit');
    }

    const extension = file.mimetype === 'image/jpeg' ? 'jpg' : file.mimetype.split('/')[1];
    const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.${extension}`;
    const absolutePath = path.join(this.uploadDir, fileName);

    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(absolutePath, file.buffer);

    this.logger.log(`Stored upload ${fileName} (${file.size} bytes) via local driver`);
    return { url: `/uploads/${fileName}`, driver: this.driver };
  }
}
