import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  PaginatedResult,
  PaginationQueryDto,
  toPaginatedResult,
} from '../../common/dto/pagination.dto';

const UPLOADER_INCLUDE = { uploadedBy: { select: { id: true, fullName: true } } };

type MediaAssetWithUploader = Prisma.MediaAssetGetPayload<{ include: typeof UPLOADER_INCLUDE }>;

export interface MediaAssetView {
  id: string;
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  uploadedBy: { id: string; fullName: string } | null;
  createdAt: Date;
}

export interface UploadMetadata {
  uploadedById?: string;
  width?: number;
  height?: number;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Persist an uploaded image through the storage driver and register the
   * asset so the admin media library can list, inspect, and delete it.
   */
  async uploadImage(file: Express.Multer.File, meta: UploadMetadata = {}): Promise<MediaAssetView> {
    const stored = await this.storage.saveImage(file);
    const filename = stored.url.split('/').pop() || stored.url;
    const asset = await this.prisma.mediaAsset.create({
      data: {
        url: stored.url,
        filename,
        originalName: this.sanitizeOriginalName(file.originalname, filename),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        width: meta.width ?? null,
        height: meta.height ?? null,
        uploadedById: meta.uploadedById ?? null,
      },
      include: UPLOADER_INCLUDE,
    });
    return this.toView(asset);
  }

  async listAssets(pagination: PaginationQueryDto): Promise<PaginatedResult<MediaAssetView>> {
    const [assets, total] = await this.prisma.$transaction([
      this.prisma.mediaAsset.findMany({
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: UPLOADER_INCLUDE,
      }),
      this.prisma.mediaAsset.count(),
    ]);
    return toPaginatedResult(
      assets.map((asset) => this.toView(asset)),
      total,
      pagination,
    );
  }

  /**
   * The database row is removed first so listings stay consistent even if the
   * file unlink were to fail; a stranded file is harmless, a dangling row is not.
   */
  async deleteAsset(id: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }
    await this.prisma.mediaAsset.delete({ where: { id } });
    await this.storage.deleteImage(asset.url);
  }

  private sanitizeOriginalName(originalName: string | undefined, fallback: string): string {
    const cleaned = (originalName || '').replace(/[\r\n/\\]+/g, ' ').trim();
    return cleaned.slice(0, 255) || fallback;
  }

  private toView(asset: MediaAssetWithUploader): MediaAssetView {
    return {
      id: asset.id,
      url: asset.url,
      filename: asset.filename,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      uploadedBy: asset.uploadedBy ? { id: asset.uploadedBy.id, fullName: asset.uploadedBy.fullName } : null,
      createdAt: asset.createdAt,
    };
  }
}
