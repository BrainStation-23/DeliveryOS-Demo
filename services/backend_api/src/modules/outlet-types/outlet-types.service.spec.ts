import { ConflictException, NotFoundException } from '@nestjs/common';
import { OutletTypesService } from './outlet-types.service';

describe('OutletTypesService', () => {
  let service: OutletTypesService;
  let prisma: {
    outletType: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    vendor: { count: jest.Mock };
  };

  const typeRow = { id: 'type-1', name: 'Restaurant', slug: 'restaurant', isActive: true, sortOrder: 0 };

  beforeEach(() => {
    prisma = {
      outletType: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(typeRow),
        create: jest.fn().mockResolvedValue(typeRow),
        update: jest.fn().mockResolvedValue(typeRow),
        delete: jest.fn().mockResolvedValue(typeRow),
      },
      vendor: { count: jest.fn().mockResolvedValue(0) },
    };
    service = new OutletTypesService(prisma as never);
  });

  describe('create', () => {
    it('derives a kebab-case slug from the name when omitted', async () => {
      prisma.outletType.findUnique.mockResolvedValue(null);
      await service.create({ name: 'Super Shop' });

      expect(prisma.outletType.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Super Shop', slug: 'super-shop', isActive: true }),
      });
    });

    it('rejects a duplicate name with a ConflictException', async () => {
      prisma.outletType.findUnique.mockResolvedValueOnce(typeRow).mockResolvedValueOnce(null);
      await expect(service.create({ name: 'Restaurant' })).rejects.toThrow(ConflictException);
      expect(prisma.outletType.create).not.toHaveBeenCalled();
    });

    it('rejects a slug collision with a different display name', async () => {
      prisma.outletType.findUnique.mockImplementation(async ({ where }: { where: { slug?: string; name?: string } }) =>
        where.slug === 'restaurant' ? { id: 'other' } : null,
      );
      await expect(service.create({ name: 'Diner', slug: 'restaurant' })).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException for an unknown id', async () => {
      prisma.outletType.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { isActive: false })).rejects.toThrow(NotFoundException);
    });

    it('toggles visibility without touching other fields', async () => {
      await service.update('type-1', { isActive: false });

      expect(prisma.outletType.update).toHaveBeenCalledWith({
        where: { id: 'type-1' },
        data: { isActive: false },
      });
    });

    it('refuses renaming onto an existing name', async () => {
      prisma.outletType.findUnique.mockImplementation(async ({ where }: { where: { name?: string; id?: string } }) =>
        where.name === 'Grocery' ? { id: 'type-2' } : typeRow,
      );
      await expect(service.update('type-1', { name: 'Grocery' })).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('refuses deletion while outlets are still assigned (soft-toggle is the control)', async () => {
      prisma.outletType.findUnique.mockResolvedValue({ ...typeRow, _count: { outlets: 3 } });
      await expect(service.remove('type-1')).rejects.toThrow(ConflictException);
      expect(prisma.outletType.delete).not.toHaveBeenCalled();
    });

    it('deletes an unassigned type', async () => {
      prisma.outletType.findUnique.mockResolvedValue({ ...typeRow, _count: { outlets: 0 } });
      const result = await service.remove('type-1');
      expect(result).toEqual({ id: 'type-1', name: 'Restaurant' });
      expect(prisma.outletType.delete).toHaveBeenCalledWith({ where: { id: 'type-1' } });
    });
  });

  describe('listings', () => {
    it('admin listing includes deactivated types with outlet counts', async () => {
      await service.listForAdmin();
      expect(prisma.outletType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: { _count: { select: { outlets: true } } } }),
      );
    });

    it('public listing selects only active-safe fields', async () => {
      await service.listActive();
      expect(prisma.outletType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
      const select = prisma.outletType.findMany.mock.calls[0][0].select;
      expect(Object.keys(select).sort()).toEqual(['id', 'name', 'slug', 'sortOrder']);
    });
  });
});
