import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
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

    // mimetype is client-controlled; sniff magic bytes so a renamed payload
    // cannot masquerade as an image.
    if (!(await this.hasImageMagicBytes(file.buffer))) {
      throw new BadRequestException('File content does not match an allowed image type');
    }

    const extension = file.mimetype === 'image/jpeg' ? 'jpg' : file.mimetype.split('/')[1];
    const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.${extension}`;
    const absolutePath = path.join(this.uploadDir, fileName);

    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(absolutePath, file.buffer);

    this.logger.log(`Stored upload ${fileName} (${file.size} bytes) via local driver`);
    return { url: `/uploads/${fileName}`, driver: this.driver };
  }

  /**
   * Remove a previously stored image. `force` keeps repeated cleanup
   * idempotent, and basename() confines the unlink to the upload directory
   * even if a caller-supplied URL carries traversal segments.
   */
  async deleteImage(url: string): Promise<void> {
    if (this.driver !== 'local') {
      throw new BadRequestException(`Storage driver "${this.driver}" is not supported yet; use "local"`);
    }
    const fileName = path.basename(url);
    if (!fileName || fileName === '.' || fileName === '/') {
      throw new BadRequestException('Invalid stored image URL');
    }
    await rm(path.join(this.uploadDir, fileName), { force: true });
    this.logger.log(`Deleted upload ${fileName} via local driver`);
  }

  private async hasImageMagicBytes(buffer: Buffer): Promise<boolean> {
    const head = buffer.subarray(0, 12);
    if (head.length < 12) return false;
    // JPEG: FF D8 FF — PNG: 89 50 4E 47 0D 0A 1A 0A — GIF: GIF8
    if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return true;
    if (
      head[0] === 0x89 &&
      head[1] === 0x50 &&
      head[2] === 0x4e &&
      head[3] === 0x47 &&
      head[4] === 0x0d &&
      head[5] === 0x0a &&
      head[6] === 0x1a &&
      head[7] === 0x0a
    ) {
      return true;
    }
    if (head.subarray(0, 3).toString('latin1') === 'GIF') return true;
    // WebP: RIFF....WEBP
    return head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP';
  }
}
