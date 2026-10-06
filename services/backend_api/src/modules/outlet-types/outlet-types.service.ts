import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateOutletTypeDto, UpdateOutletTypeDto } from './dto/outlet-type.dto';

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class OutletTypesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Admin console listing: every type incl. deactivated, with assigned outlet counts. */
  async listForAdmin() {
    return this.prisma.outletType.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { outlets: true } } },
    });
  }

  /** Public listing for customer category chips: active types only, ordered. */
  async listActive() {
    return this.prisma.outletType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, sortOrder: true },
    });
  }

  async create(dto: CreateOutletTypeDto) {
    const slug = dto.slug ?? slugifyName(dto.name);
    if (!slug) {
      throw new ConflictException('Could not derive a slug from this name; provide one explicitly');
    }

    const [nameClash, slugClash] = await Promise.all([
      this.prisma.outletType.findUnique({ where: { name: dto.name } }),
      this.prisma.outletType.findUnique({ where: { slug } }),
    ]);
    if (nameClash) {
      throw new ConflictException(`Outlet type "${dto.name}" already exists`);
    }
    if (slugClash) {
      throw new ConflictException(`Outlet type slug "${slug}" is already taken`);
    }

    return this.prisma.outletType.create({
      data: {
        name: dto.name,
        slug,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateOutletTypeDto) {
    const existing = await this.prisma.outletType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Outlet type with ID "${id}" not found`);
    }

    const nextName = dto.name ?? existing.name;
    const nextSlug = dto.slug ?? existing.slug;

    if (nextName !== existing.name) {
      const nameClash = await this.prisma.outletType.findUnique({ where: { name: nextName } });
      if (nameClash) {
        throw new ConflictException(`Outlet type "${nextName}" already exists`);
      }
    }
    if (nextSlug !== existing.slug) {
      const slugClash = await this.prisma.outletType.findUnique({ where: { slug: nextSlug } });
      if (slugClash) {
        throw new ConflictException(`Outlet type slug "${nextSlug}" is already taken`);
      }
    }

    return this.prisma.outletType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: nextName }),
        ...(dto.slug !== undefined && { slug: nextSlug }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(id: string) {
    const type = await this.prisma.outletType.findUnique({
      where: { id },
      include: { _count: { select: { outlets: true } } },
    });
    if (!type) {
      throw new NotFoundException(`Outlet type with ID "${id}" not found`);
    }

    if (type._count.outlets > 0) {
      throw new ConflictException(
        `Outlet type "${type.name}" still has ${type._count.outlets} assigned outlet(s) — reassign them to another type or deactivate this one instead`,
      );
    }

    await this.prisma.outletType.delete({ where: { id } });
    return { id, name: type.name };
  }

  /**
   * List all store outlets assigned to a specific outlet type with basic information.
   */
  async listOutletsForType(id: string) {
    const type = await this.prisma.outletType.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, isActive: true },
    });
    if (!type) {
      throw new NotFoundException(`Outlet type with ID "${id}" not found`);
    }

    const outlets = await this.prisma.vendor.findMany({
      where: { typeId: id },
      include: {
        brand: { select: { id: true, name: true, logoUrl: true } },
        _count: { select: { products: true, orders: true, staff: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      type,
      outlets: outlets.map((v) => ({
        id: v.id,
        name: v.name,
        brandId: v.brandId,
        brandName: v.brand?.name || null,
        brandLogoUrl: v.brand?.logoUrl || null,
        addressText: v.addressText,
        contactPhone: v.contactPhone,
        latitude: v.latitude,
        longitude: v.longitude,
        isActive: v.isActive,
        isBusy: v.isBusy,
        orderFlowMode: v.orderFlowMode,
        commissionRate: Number(v.commissionRate),
        defaultPrepTimeMinutes: v.defaultPrepTimeMinutes,
        deliveryRadiusKm: Number(v.deliveryRadiusKm),
        totalProducts: v._count.products,
        totalOrders: v._count.orders,
        totalStaff: v._count.staff,
        createdAt: v.createdAt,
      })),
    };
  }
}
