import { NotFoundException } from '@nestjs/common';
import { MediaService } from './media.service';

const mockFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
  fieldname: 'file',
  originalname: 'hero banner.png',
  encoding: '7bit',
  mimetype: 'image/png',
  buffer: Buffer.from('png'),
  size: 2048,
  ...overrides,
}) as Express.Multer.File;

const storedAsset = {
  id: 'asset-1',
  url: '/uploads/2026-10-02-abc123.png',
  filename: '2026-10-02-abc123.png',
  originalName: 'hero banner.png',
  mimeType: 'image/png',
  sizeBytes: 2048,
  width: null,
  height: null,
  uploadedById: 'user-1',
  createdAt: new Date('2026-10-02T10:00:00.000Z'),
  uploadedBy: { id: 'user-1', fullName: 'Tariqul Islam' },
};

describe('MediaService - central media library', () => {
  let service: MediaService;
  let prisma: {
    mediaAsset: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let storage: { saveImage: jest.Mock; deleteImage: jest.Mock };

  beforeEach(() => {
    prisma = {
      mediaAsset: {
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...storedAsset, ...data }),
        ),
        findMany: jest.fn().mockResolvedValue([storedAsset]),
        findUnique: jest.fn().mockResolvedValue(storedAsset),
        delete: jest.fn().mockResolvedValue(storedAsset),
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: jest.fn().mockResolvedValue([[storedAsset], 1]),
    };
    storage = {
      saveImage: jest.fn().mockResolvedValue({ url: '/uploads/2026-10-02-abc123.png', driver: 'local' }),
      deleteImage: jest.fn().mockResolvedValue(undefined),
    };
    service = new MediaService(prisma as never, storage as never);
  });

  it('stores the file and registers the asset with uploader and client-measured dimensions', async () => {
    const view = await service.uploadImage(mockFile(), {
      uploadedById: 'user-1',
      width: 1600,
      height: 900,
    });

    expect(storage.saveImage).toHaveBeenCalledTimes(1);
    expect(prisma.mediaAsset.create).toHaveBeenCalledWith({
      data: {
        url: '/uploads/2026-10-02-abc123.png',
        filename: '2026-10-02-abc123.png',
        originalName: 'hero banner.png',
        mimeType: 'image/png',
        sizeBytes: 2048,
        width: 1600,
        height: 900,
        uploadedById: 'user-1',
      },
      include: { uploadedBy: { select: { id: true, fullName: true } } },
    });
    expect(view).toMatchObject({
      id: 'asset-1',
      url: '/uploads/2026-10-02-abc123.png',
      width: 1600,
      uploadedBy: { fullName: 'Tariqul Islam' },
    });
  });

  it('sanitizes hostile original names and falls back to the stored filename', async () => {
    await service.uploadImage(mockFile({ originalname: '../../etc/passwd\nroot' }));

    expect(prisma.mediaAsset.create.mock.calls[0][0].data.originalName).toBe('.. .. etc passwd root');

    await service.uploadImage(mockFile({ originalname: '' }));
    expect(prisma.mediaAsset.create.mock.calls[1][0].data.originalName).toBe('2026-10-02-abc123.png');
  });

  it('does not register an asset when the storage driver rejects the file', async () => {
    storage.saveImage.mockRejectedValue(new Error('Image exceeds the 5 MB size limit'));

    await expect(service.uploadImage(mockFile())).rejects.toThrow('5 MB');
    expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
  });

  it('lists assets newest-first with pagination envelope math', async () => {
    const result = await service.listAssets({ page: 2, limit: 10, skip: 10 } as never);

    expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' }, skip: 10, take: 10 }),
    );
    expect(result).toEqual({
      items: [expect.objectContaining({ id: 'asset-1' })],
      total: 1,
      page: 2,
      limit: 10,
      totalPages: 1,
    });
  });

  it('deletes the database row before unlinking the stored file', async () => {
    await service.deleteAsset('asset-1');

    expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: 'asset-1' } });
    expect(storage.deleteImage).toHaveBeenCalledWith('/uploads/2026-10-02-abc123.png');
    expect(prisma.mediaAsset.delete.mock.invocationCallOrder[0]).toBeLessThan(
      storage.deleteImage.mock.invocationCallOrder[0],
    );
  });

  it('rejects deletion of unknown assets with 404 and touches nothing', async () => {
    prisma.mediaAsset.findUnique.mockResolvedValue(null);

    await expect(service.deleteAsset('missing')).rejects.toThrow(NotFoundException);
    expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
    expect(storage.deleteImage).not.toHaveBeenCalled();
  });
});
