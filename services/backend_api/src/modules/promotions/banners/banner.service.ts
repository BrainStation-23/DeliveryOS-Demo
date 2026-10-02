import { Injectable } from '@nestjs/common';
import { BannerLinkType } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class BannerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves active promotional banners for the Customer Home screen.
   * Deeplink targets are resolved to display names so mobile clients can
   * route CATEGORY banners without a second lookup round-trip.
   */
  async getActiveBanners() {
    const now = new Date();
    const banners = await this.prisma.banner.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        OR: [
          { endsAt: null },
          { endsAt: { gte: now } },
        ],
      },
      orderBy: {
        sortOrder: 'asc',
      },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        linkType: true,
        targetId: true,
        targetUrl: true,
        sortOrder: true,
      },
    });

    const outletIds = banners
      .filter((b) => b.linkType === BannerLinkType.OUTLET && b.targetId)
      .map((b) => b.targetId as string);
    const categoryIds = banners
      .filter((b) => b.linkType === BannerLinkType.CATEGORY && b.targetId)
      .map((b) => b.targetId as string);

    const [outlets, categories] = await Promise.all([
      outletIds.length
        ? this.prisma.vendor.findMany({
            where: { id: { in: outletIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      categoryIds.length
        ? this.prisma.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const nameById = new Map<string, string>([
      ...outlets.map((o) => [o.id, o.name] as [string, string]),
      ...categories.map((c) => [c.id, c.name] as [string, string]),
    ]);

    return banners.map((banner) => ({
      ...banner,
      targetName: banner.targetId ? nameById.get(banner.targetId) ?? null : null,
    }));
  }
}
