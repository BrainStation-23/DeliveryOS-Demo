import { Injectable } from '@nestjs/common';
import { BannerLinkType } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { haversineKm } from '../../../common/utils/haversine';

@Injectable()
export class BannerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves active promotional banners for the Customer Home screen.
   * If customer coordinates (lat, lng) are provided:
   *  - Outlet banners are filtered to only those whose outlet covers the customer
   *    (distance <= deliveryRadiusKm and vendor.isActive).
   *  - Global banners (INTERNAL, EXTERNAL without outlet, etc.) are always included.
   * If coordinates are omitted:
   *  - Outlet-specific banners are suppressed so out-of-region deals are not advertised.
   */
  async getActiveBanners(lat?: number, lng?: number) {
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

    const outlets = outletIds.length
      ? await this.prisma.vendor.findMany({
          where: { id: { in: outletIds } },
          select: {
            id: true,
            name: true,
            brand: { select: { name: true } },
            latitude: true,
            longitude: true,
            deliveryRadiusKm: true,
            isActive: true,
          },
        })
      : [];

    const outletById = new Map<string, (typeof outlets)[0]>(
      outlets.map((o) => [o.id, o]),
    );

    const hasLocation =
      lat != null &&
      lng != null &&
      !Number.isNaN(Number(lat)) &&
      !Number.isNaN(Number(lng));

    const customerLat = hasLocation ? Number(lat) : undefined;
    const customerLng = hasLocation ? Number(lng) : undefined;

    const filteredBanners = banners.filter((banner) => {
      if (banner.linkType === BannerLinkType.OUTLET && banner.targetId) {
        const outlet = outletById.get(banner.targetId);
        if (!outlet || !outlet.isActive) {
          return false;
        }
        if (customerLat === undefined || customerLng === undefined) {
          return false;
        }
        const distance = haversineKm(
          customerLat,
          customerLng,
          outlet.latitude,
          outlet.longitude,
        );
        return distance !== undefined && distance <= Number(outlet.deliveryRadiusKm);
      }

      return true;
    });

    return filteredBanners.map((banner) => {
      const outlet = banner.targetId ? outletById.get(banner.targetId) : undefined;
      return {
        ...banner,
        targetName: outlet?.name ?? null,
        targetBrandName: outlet?.brand?.name ?? null,
      };
    });
  }
}

