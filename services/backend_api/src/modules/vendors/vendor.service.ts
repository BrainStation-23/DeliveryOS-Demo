import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GetNearbyVendorsDto } from './dto/get-nearby-vendors.dto';
import { SearchVendorsDto } from './dto/search-vendors.dto';
import { ValidateAddressCoverageDto } from './dto/validate-address-coverage.dto';
import { DeliveryFeeService } from '../promotions/pricing/delivery-fee.service';

export interface RawNearbyVendorRow {
  id: string;
  name: string;
  vertical: string;
  contactPhone: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  addressText: string;
  latitude: number;
  longitude: number;
  commissionRate: number;
  deliveryRadiusKm: number;
  defaultPrepTimeMinutes: number;
  isActive: boolean;
  isBusy: boolean;
  distanceKm: number | string;
}

export interface RawOutletSearchRow {
  id: string;
  name: string;
  vertical: string;
  logoUrl: string | null;
  addressText: string;
  distanceKm: number | string;
}

export interface RawProductSearchRow {
  id: string;
  name: string;
  description: string | null;
  basePrice: number | string;
  unitType: string;
  imageUrl: string | null;
  isInStock: boolean;
  vendorId: string;
  vendorName: string;
  distanceKm: number | string;
}

export interface RawCoverageCheckRow {
  distanceKm: number | string;
  isWithinCoverage: boolean;
}

@Injectable()
export class VendorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryFeeService: DeliveryFeeService,
  ) {}

  /**
   * 1. Get Nearby Outlets filtered by customer coordinate via PostGIS ST_DWithin
   */
  async getNearbyVendors(dto: GetNearbyVendorsDto) {
    const { lat, lng, vertical, limit = 50 } = dto;

    const verticalFilter = vertical
      ? Prisma.sql`AND v.vertical = ${vertical}::"VendorVertical"`
      : Prisma.empty;

    const nearbyVendors: RawNearbyVendorRow[] = await this.prisma.$queryRaw`
      SELECT 
        v.id,
        v.name,
        v.vertical,
        v.contact_phone AS "contactPhone",
        v.logo_url AS "logoUrl",
        v.banner_url AS "bannerUrl",
        v.address_text AS "addressText",
        v.latitude,
        v.longitude,
        v.commission_rate AS "commissionRate",
        v.delivery_radius_km AS "deliveryRadiusKm",
        v.default_prep_time_minutes AS "defaultPrepTimeMinutes",
        v.is_active AS "isActive",
        v.is_busy AS "isBusy",
        ROUND((ST_Distance(
          CAST(ST_SetSRID(ST_MakePoint(v.longitude, v.latitude), 4326) AS geography),
          CAST(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) AS geography)
        ) / 1000)::numeric, 2) AS "distanceKm"
      FROM vendors v
      WHERE v.is_active = TRUE
        AND ST_DWithin(
          CAST(ST_SetSRID(ST_MakePoint(v.longitude, v.latitude), 4326) AS geography),
          CAST(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) AS geography),
          v.delivery_radius_km * 1000
        )
        ${verticalFilter}
      ORDER BY "distanceKm" ASC
      LIMIT ${limit};
    `;

    const feeConfig = await this.deliveryFeeService.getConfig();

    return nearbyVendors.map((vendor) => {
      const distanceKm = Number(vendor.distanceKm);
      return {
        ...vendor,
        distanceKm,
        deliveryRadiusKm: Number(vendor.deliveryRadiusKm),
        deliveryFee: this.deliveryFeeService.computeFee(feeConfig, distanceKm),
      };
    });
  }

  /**
   * 2. Instant Search Outlets & Available Menu Items within coverage
   */
  async search(dto: SearchVendorsDto) {
    const { q, lat, lng } = dto;
    const term = `%${q}%`;

    // 1. Matching Outlets within coverage
    const outlets: RawOutletSearchRow[] = await this.prisma.$queryRaw`
      SELECT 
        v.id,
        v.name,
        v.vertical,
        v.logo_url AS "logoUrl",
        v.address_text AS "addressText",
        ROUND((ST_Distance(
          CAST(ST_SetSRID(ST_MakePoint(v.longitude, v.latitude), 4326) AS geography),
          CAST(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) AS geography)
        ) / 1000)::numeric, 2) AS "distanceKm"
      FROM vendors v
      WHERE v.is_active = TRUE
        AND v.name ILIKE ${term}
        AND ST_DWithin(
          CAST(ST_SetSRID(ST_MakePoint(v.longitude, v.latitude), 4326) AS geography),
          CAST(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) AS geography),
          v.delivery_radius_km * 1000
        )
      ORDER BY "distanceKm" ASC
      LIMIT 10;
    `;

    // 2. Matching Products from active outlets within coverage
    const items: RawProductSearchRow[] = await this.prisma.$queryRaw`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.base_price AS "basePrice",
        p.unit_type AS "unitType",
        p.image_url AS "imageUrl",
        p.is_in_stock AS "isInStock",
        v.id AS "vendorId",
        v.name AS "vendorName",
        ROUND((ST_Distance(
          CAST(ST_SetSRID(ST_MakePoint(v.longitude, v.latitude), 4326) AS geography),
          CAST(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) AS geography)
        ) / 1000)::numeric, 2) AS "distanceKm"
      FROM products p
      JOIN vendors v ON p.vendor_id = v.id
      WHERE v.is_active = TRUE
        AND (p.name ILIKE ${term} OR p.description ILIKE ${term})
        AND ST_DWithin(
          CAST(ST_SetSRID(ST_MakePoint(v.longitude, v.latitude), 4326) AS geography),
          CAST(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) AS geography),
          v.delivery_radius_km * 1000
        )
      ORDER BY "distanceKm" ASC, p.name ASC
      LIMIT 20;
    `;

    return {
      outlets: outlets.map((o) => ({ ...o, distanceKm: Number(o.distanceKm) })),
      items: items.map((i) => ({ ...i, distanceKm: Number(i.distanceKm), basePrice: Number(i.basePrice) })),
    };
  }

  /**
   * 3. Get Outlet Details & Categorized Menu Catalog
   */
  async getCatalog(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        operatingHours: {
          orderBy: { dayOfWeek: 'asc' },
        },
        categories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            products: {
              where: { isInStock: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                variants: {
                  where: { isInStock: true },
                },
                addonGroups: {
                  include: {
                    addons: {
                      where: { isInStock: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!vendor || !vendor.isActive) {
      throw new NotFoundException('Vendor outlet not found or currently inactive');
    }

    return vendor;
  }

  /**
   * 4. Cart Address Geofence Guard (Strict Coverage Enforcement)
   * When an `addressId` is supplied, ownership is enforced exactly like
   * checkout — an authenticated caller may only probe their own addresses.
   */
  async validateAddressCoverage(dto: ValidateAddressCoverageDto, userId?: string) {
    const { vendorId, addressId } = dto;

    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor || !vendor.isActive) {
      throw new NotFoundException('Vendor outlet not found or currently inactive');
    }

    let lat = dto.latitude;
    let lng = dto.longitude;

    if (addressId) {
      const address = await this.prisma.customerAddress.findUnique({
        where: { id: addressId },
      });
      if (!address) {
        throw new NotFoundException('Customer address record not found');
      }
      if (!userId || address.userId !== userId) {
        throw new ForbiddenException('You do not have permission to use this delivery address');
      }
      lat = address.latitude;
      lng = address.longitude;
    }

    if (lat === undefined || lng === undefined) {
      throw new BadRequestException('Either addressId or latitude/longitude coordinates must be provided');
    }

    const checkResult: RawCoverageCheckRow[] = await this.prisma.$queryRaw`
      SELECT 
        ROUND((ST_Distance(
          CAST(ST_SetSRID(ST_MakePoint(${vendor.longitude}, ${vendor.latitude}), 4326) AS geography),
          CAST(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) AS geography)
        ) / 1000)::numeric, 2) AS "distanceKm",
        ST_DWithin(
          CAST(ST_SetSRID(ST_MakePoint(${vendor.longitude}, ${vendor.latitude}), 4326) AS geography),
          CAST(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) AS geography),
          ${Number(vendor.deliveryRadiusKm)} * 1000
        ) AS "isWithinCoverage"
    `;

    const isWithinCoverage = checkResult[0]?.isWithinCoverage === true;
    const distanceKm = Number(checkResult[0]?.distanceKm);

    if (!isWithinCoverage) {
      throw new HttpException(
        {
          success: false,
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          error: 'ADDRESS_OUT_OF_COVERAGE',
          message: `Selected address is outside ${vendor.name}'s delivery coverage radius of ${vendor.deliveryRadiusKm} km. Distance is ${distanceKm} km.`,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const feeConfig = await this.deliveryFeeService.getConfig();
    const estimatedDeliveryFee = this.deliveryFeeService.computeFee(feeConfig, distanceKm);

    return {
      isWithinCoverage: true,
      distanceKm,
      deliveryRadiusKm: Number(vendor.deliveryRadiusKm),
      estimatedDeliveryFee,
      isBusy: vendor.isBusy,
      isActive: vendor.isActive,
    };
  }
}
