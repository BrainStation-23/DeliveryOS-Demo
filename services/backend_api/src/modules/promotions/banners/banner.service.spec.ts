import { BannerService } from './banner.service';
import { BannerLinkType } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('BannerService', () => {
  let service: BannerService;
  let prisma: {
    banner: { findMany: jest.Mock };
    vendor: { findMany: jest.Mock };
  };

  const gulshanVendor = {
    id: 'vendor-gulshan',
    name: 'Burger Lab Gulshan',
    latitude: 23.7925,
    longitude: 90.4078,
    deliveryRadiusKm: 5.0,
    isActive: true,
  };

  const dhanmondiVendor = {
    id: 'vendor-dhanmondi',
    name: 'Pizza Lab Dhanmondi',
    latitude: 23.7461,
    longitude: 90.3760,
    deliveryRadiusKm: 4.0,
    isActive: true,
  };

  const inactiveVendor = {
    id: 'vendor-closed',
    name: 'Closed Kitchen',
    latitude: 23.7925,
    longitude: 90.4078,
    deliveryRadiusKm: 5.0,
    isActive: false,
  };

  const mockBanners = [
    {
      id: 'banner-1',
      title: 'Gulshan Feast',
      imageUrl: '/img1.png',
      linkType: BannerLinkType.OUTLET,
      targetId: 'vendor-gulshan',
      targetUrl: null,
      sortOrder: 1,
    },
    {
      id: 'banner-2',
      title: 'Dhanmondi Pizza',
      imageUrl: '/img2.png',
      linkType: BannerLinkType.OUTLET,
      targetId: 'vendor-dhanmondi',
      targetUrl: null,
      sortOrder: 2,
    },
    {
      id: 'banner-3',
      title: 'Global Search Deals',
      imageUrl: '/img3.png',
      linkType: BannerLinkType.INTERNAL,
      targetId: null,
      targetUrl: '/search?q=burger',
      sortOrder: 3,
    },
    {
      id: 'banner-4',
      title: 'External Partner Offer',
      imageUrl: '/img4.png',
      linkType: BannerLinkType.EXTERNAL,
      targetId: null,
      targetUrl: 'https://partner.com/deal',
      sortOrder: 4,
    },
    {
      id: 'banner-5',
      title: 'Closed Kitchen Deal',
      imageUrl: '/img5.png',
      linkType: BannerLinkType.OUTLET,
      targetId: 'vendor-closed',
      targetUrl: null,
      sortOrder: 5,
    },
  ];

  beforeEach(() => {
    prisma = {
      banner: { findMany: jest.fn().mockResolvedValue(mockBanners) },
      vendor: {
        findMany: jest.fn().mockResolvedValue([gulshanVendor, dhanmondiVendor, inactiveVendor]),
      },
    };
    service = new BannerService(prisma as unknown as PrismaService);
  });

  it('filters outlet banners by user distance within outlet delivery radius', async () => {
    // Customer in Gulshan 2 (coordinates close to Gulshan outlet ~ 500m)
    const result = await service.getActiveBanners(23.795, 90.41);

    const ids = result.map((b) => b.id);
    expect(ids).toContain('banner-1'); // Gulshan within radius
    expect(ids).not.toContain('banner-2'); // Dhanmondi is ~7km away, > 4km radius
    expect(ids).not.toContain('banner-5'); // Inactive vendor filtered out
    expect(ids).toContain('banner-3'); // Global internal deeplink included
    expect(ids).toContain('banner-4'); // Global external URL included

    const gulshanBanner = result.find((b) => b.id === 'banner-1');
    expect(gulshanBanner?.targetName).toBe('Burger Lab Gulshan');
  });

  it('suppresses outlet banners when customer coordinates are not provided', async () => {
    const result = await service.getActiveBanners();

    const ids = result.map((b) => b.id);
    expect(ids).not.toContain('banner-1');
    expect(ids).not.toContain('banner-2');
    expect(ids).not.toContain('banner-5');
    expect(ids).toContain('banner-3');
    expect(ids).toContain('banner-4');
  });

  it('includes outlet banner for customer located within Dhanmondi radius', async () => {
    // Customer in Dhanmondi
    const result = await service.getActiveBanners(23.7465, 90.377);

    const ids = result.map((b) => b.id);
    expect(ids).toContain('banner-2'); // Dhanmondi included
    expect(ids).not.toContain('banner-1'); // Gulshan excluded
    expect(ids).toContain('banner-3'); // Global included
  });
});
