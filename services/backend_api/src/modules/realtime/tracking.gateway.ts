import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RedisAdapter } from '@socket.io/redis-adapter';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { requiredEnv, getAllowedOrigins } from '../../common/config/env';
import { PermissionScope, UserRole } from '@prisma/client';

export interface NewOrderRealtimePayload {
  orderId?: string;
  orderNumber?: string;
  vendorId?: string;
  vendorName?: string;
  itemCount?: number;
  totalAmount?: number;
  paymentMethod?: string;
  customerNotes?: string | null;
  items?: Array<{
    name: string;
    quantity: number;
    notes?: string;
  }>;
  placedAt?: string;
  [key: string]: unknown;
}

export interface DispatchBroadcastPayload {
  orderId: string;
  orderNumber?: string;
  vendorId?: string;
  vendorName?: string;
  vendorAddress?: string;
  deliveryArea?: string;
  itemCount?: number;
  totalAmount?: number;
  riderEarnings?: number;
  timeoutSeconds?: number;
  [key: string]: unknown;
}

@WebSocketGateway({
  namespace: '/events',
  cors: { origin: getAllowedOrigins(), credentials: true },
})
export class TrackingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async afterInit() {
    // Fan events across API replicas via Redis pub/sub (single-replica safe).
    // Nest injects the namespace here; its `adapter` property takes an Adapter
    // instance (the typed `Server.adapter()` method never exists at runtime).
    const [pubClient, subClient] = await this.redis.getAdapterClients();
    const namespace = this.server as unknown as { adapter: unknown; name?: string };
    namespace.adapter = new RedisAdapter(namespace, pubClient, subClient);
    this.logger.log('📡 TrackingGateway initialized on namespace /events (Redis adapter)');
  }

  /**
   * Handshake JWT Authentication & Automatic Room Subscription
   */
  async handleConnection(client: Socket) {
    try {
      const auth = client.handshake.auth;
      const headers = client.handshake.headers;
      let token = auth?.token;

      if (!token && headers.authorization) {
        const parts = headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
          token = parts[1];
        }
      }

      if (!token) {
        this.logger.warn(`Client ${client.id} connection rejected: missing token`);
        client.emit('error', { message: 'Authentication token required' });
        client.disconnect(true);
        return;
      }

      const secret = requiredEnv('JWT_SECRET');
      const decoded = jwt.verify(token, secret) as { sub: string; role: string };

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
        include: {
          vendorStaff: true,
          rider: true,
        },
      });

      if (!user || user.status !== 'ACTIVE') {
        this.logger.warn(`Client ${client.id} rejected: inactive or non-existent user`);
        client.emit('error', { message: 'User inactive or not found' });
        client.disconnect(true);
        return;
      }

      client.data.user = user;

      // -----------------------------------------------------------------------
      // Auto-Join Scoped Rooms per TID-04
      // -----------------------------------------------------------------------
      if (user.role === UserRole.CUSTOMER) {
        const customerRoom = `user_${user.id}`;
        await client.join(customerRoom);
        this.logger.log(`Customer ${user.phone} joined room ${customerRoom}`);
      } else if (user.role === UserRole.VENDOR_ADMIN) {
        for (const staff of user.vendorStaff) {
          if (staff.scope === PermissionScope.PARTICULAR_OUTLET && staff.vendorId) {
            const vendorRoom = `vendor_${staff.vendorId}`;
            await client.join(vendorRoom);
            this.logger.log(`Vendor Staff ${user.phone} joined outlet room ${vendorRoom}`);
          } else if (staff.scope === PermissionScope.ALL_OUTLETS_MASTER && staff.brandId) {
            const brandRoom = `brand_${staff.brandId}`;
            await client.join(brandRoom);
            // Join all branch outlets under this brand
            const brandOutlets = await this.prisma.vendor.findMany({
              where: { brandId: staff.brandId },
              select: { id: true },
            });
            for (const outlet of brandOutlets) {
              await client.join(`vendor_${outlet.id}`);
            }
            this.logger.log(
              `Master Staff ${user.phone} joined brand room ${brandRoom} and ${brandOutlets.length} outlet rooms`,
            );
          }
        }
      } else if (user.role === UserRole.RIDER) {
        const riderId = user.rider?.id || user.id;
        const riderRoom = `rider_${riderId}`;
        await client.join(riderRoom);
        await client.join('riders_pool');
        this.logger.log(`Rider ${user.phone} joined ${riderRoom} and riders_pool`);
      } else if (user.role === UserRole.SUPER_ADMIN) {
        await client.join('admin_hq');
        await client.join('admin_fleet');
        this.logger.log(`Super Admin ${user.phone} joined admin_hq and admin_fleet`);
      }

      client.emit('connected', {
        message: 'Successfully connected and authenticated to DeliveryOS Realtime Gateway',
        userId: user.id,
        role: user.role,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      this.logger.warn(`Client ${client.id} authentication failed: ${errorMessage}`);
      client.emit('error', { message: 'Invalid or expired authentication token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data?.user;
    this.logger.log(`Client disconnected: ${client.id} (User: ${user?.phone || 'Anonymous'})`);
  }

  // ---------------------------------------------------------------------------
  // Dynamic Order Room Subscriptions
  // ---------------------------------------------------------------------------
  @SubscribeMessage('order:join')
  async handleJoinOrder(client: Socket, payload: { orderId: string }) {
    if (!payload?.orderId) return;

    const user = client.data?.user;
    if (!user) {
      client.emit('error', { message: 'Authentication not ready; reconnect and retry' });
      return;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: payload.orderId },
      select: {
        customerId: true,
        vendorId: true,
        riderId: true,
        vendor: { select: { brandId: true } },
      },
    });

    if (!order || !this.canAccessOrder(user, order)) {
      this.logger.warn(
        `Client ${client.id} (User: ${user?.phone || 'unknown'}) denied join to order_${payload.orderId}`,
      );
      client.emit('error', { message: 'Not authorized to subscribe to this order' });
      return;
    }

    const room = `order_${payload.orderId}`;
    await client.join(room);
    this.logger.log(`Client ${client.id} joined dynamic order room: ${room}`);
    return { event: 'order:joined', room };
  }

  private canAccessOrder(
    user: {
      id: string;
      role: UserRole;
      rider?: { id: string } | null;
      vendorStaff?: Array<{ scope: PermissionScope; vendorId: string | null; brandId: string | null }>;
    },
    order: {
      customerId: string;
      vendorId: string;
      riderId: string | null;
      vendor: { brandId: string | null } | null;
    },
  ): boolean {
    switch (user.role) {
      case UserRole.SUPER_ADMIN:
        return true;
      case UserRole.CUSTOMER:
        return order.customerId === user.id;
      case UserRole.RIDER:
        return Boolean(order.riderId) && order.riderId === (user.rider?.id || user.id);
      case UserRole.VENDOR_ADMIN:
        return Boolean(
          user.vendorStaff?.some((staff) =>
            staff.scope === PermissionScope.PARTICULAR_OUTLET
              ? staff.vendorId === order.vendorId
              : Boolean(staff.brandId) && staff.brandId === order.vendor?.brandId,
          ),
        );
      default:
        return false;
    }
  }

  @SubscribeMessage('order:leave')
  async handleLeaveOrder(client: Socket, payload: { orderId: string }) {
    if (!payload?.orderId) return;
    const room = `order_${payload.orderId}`;
    await client.leave(room);
    this.logger.log(`Client ${client.id} left order room: ${room}`);
    return { event: 'order:left', room };
  }

  @SubscribeMessage('rider:location:update')
  @SubscribeMessage('rider:location_update')
  async handleRiderLocationUpdate(
    client: Socket,
    payload: {
      latitude: number;
      longitude: number;
      bearing?: number;
      speed?: number;
      activeOrderId?: string;
    },
  ) {
    const user = client.data?.user;
    if (!user || user.role !== UserRole.RIDER) return;

    const riderId = user.rider?.id || user.id;

    // 1. Update Redis Geospatial index
    await this.redis.geoadd(
      'riders:locations:active',
      payload.longitude,
      payload.latitude,
      riderId,
    );

    // 2. Cache Telemetry in Redis
    const telemetry = {
      riderId,
      fullName: user.fullName,
      phone: user.phone,
      latitude: payload.latitude,
      longitude: payload.longitude,
      bearing: payload.bearing ?? 0,
      speed: payload.speed ?? 0,
      updatedAt: new Date().toISOString(),
    };
    await this.redis.set(`rider:telemetry:${riderId}`, JSON.stringify(telemetry), 300);

    // 3. Check for active order
    const activeOrderId =
      payload.activeOrderId || (await this.redis.get(`rider:active_order:${riderId}`));

    if (activeOrderId) {
      let estimatedMinutesRemaining = 10;

      // Compute dynamic ETA to customer destination
      const order = await this.prisma.order.findUnique({
        where: { id: activeOrderId },
        select: { deliveryAddressSnapshot: true },
      });

      if (order?.deliveryAddressSnapshot) {
        const dest = order.deliveryAddressSnapshot as { latitude?: number; longitude?: number };
        if (dest.latitude && dest.longitude) {
          const distanceKm = this.calculateHaversineDistanceKm(
            payload.latitude,
            payload.longitude,
            dest.latitude,
            dest.longitude,
          );
          let avgSpeed = 25;
          try {
            const econSetting = await this.prisma.systemSetting.findUnique({
              where: { key: 'delivery_economics' },
            });
            if (econSetting?.value && typeof econSetting.value === 'object') {
              avgSpeed = (econSetting.value as { eta_avg_speed_kmh?: number }).eta_avg_speed_kmh || 25;
            }
          } catch {
            avgSpeed = 25;
          }
          estimatedMinutesRemaining = Math.max(1, Math.round((distanceKm / avgSpeed) * 60));
        }
      }

      // Cache live location snapshot for the order in Redis
      await this.redis.set(
        `order:live_location:${activeOrderId}`,
        JSON.stringify({
          ...telemetry,
          estimatedMinutesRemaining,
        }),
        300,
      );

      // Stream to customer tracking screen room
      this.notifyRiderLocationMoved(activeOrderId, {
        latitude: payload.latitude,
        longitude: payload.longitude,
        bearing: payload.bearing ?? 0,
        estimatedMinutesRemaining,
      });
    }

    // 4. Stream live courier telemetry to Admin Fleet Radar
    this.server.to('admin_fleet').emit('rider:location', {
      event: 'rider:location',
      data: {
        riderId,
        fullName: user.fullName,
        phone: user.phone,
        latitude: payload.latitude,
        longitude: payload.longitude,
        bearing: payload.bearing ?? 0,
        speed: payload.speed ?? 0,
        hasActiveOrder: Boolean(activeOrderId),
        activeOrderId: activeOrderId || null,
        updatedAt: telemetry.updatedAt,
      },
    });
  }

  private calculateHaversineDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  // ---------------------------------------------------------------------------
  // Broadcast APIs
  // ---------------------------------------------------------------------------

  /**
   * Event: order:new (Server -> Vendor Console & Admin)
   * Triggers audio alarm on vendor KDS screen
   */
  notifyNewOrder(vendorId: string, orderData: NewOrderRealtimePayload) {
    const payload = {
      event: 'order:new',
      data: orderData,
    };
    this.server.to(`vendor_${vendorId}`).to('admin_hq').emit('order:new', payload);
    this.logger.log(`Emitted [order:new] for order ${orderData.orderNumber || orderData.orderId} to room vendor_${vendorId}`);
  }

  /**
   * Event: order:status:changed (Server -> Customer App, Order Room, Vendor KDS & Admin)
   */
  async notifyOrderStatusChanged(
    orderId: string,
    customerId: string,
    previousStatus: string,
    newStatus: string,
    metadata?: Record<string, unknown>,
  ) {
    let vendorId =
      (metadata?.vendorId as string | undefined) ||
      (metadata?.vendor as { id?: string } | undefined)?.id;
    if (!vendorId && this.prisma) {
      try {
        const order = await this.prisma.order.findUnique({
          where: { id: orderId },
          select: { vendorId: true },
        });
        if (order?.vendorId) {
          vendorId = order.vendorId;
        }
      } catch {
        // Non-blocking fallback
      }
    }

    const payload = {
      event: 'order:status:changed',
      data: {
        orderId,
        previousStatus,
        newStatus,
        timestamp: new Date().toISOString(),
        ...(vendorId ? { vendorId } : {}),
        ...metadata,
      },
    };

    const targetRooms: string[] = [
      `order_${orderId}`,
      `user_${customerId}`,
      'admin_hq',
    ];
    if (vendorId) {
      targetRooms.push(`vendor_${vendorId}`);
    }

    this.server.to(targetRooms).emit('order:status:changed', payload);

    this.logger.log(
      `Emitted [order:status:changed] for order ${orderId}: ${previousStatus} -> ${newStatus}${vendorId ? ` (vendor: ${vendorId})` : ''}`,
    );
  }

  /**
   * Event: order:rider:moved (Server -> Customer Tracking Screen)
   */
  notifyRiderLocationMoved(
    orderId: string,
    locationData: {
      latitude: number;
      longitude: number;
      bearing: number;
      estimatedMinutesRemaining?: number;
    },
  ) {
    const payload = {
      event: 'order:rider:moved',
      data: {
        orderId,
        riderLocation: {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          bearing: locationData.bearing,
        },
        estimatedMinutesRemaining: locationData.estimatedMinutesRemaining,
      },
    };
    this.server.to(`order_${orderId}`).emit('order:rider:moved', payload);
  }

  /**
   * Event: dispatch:broadcast (Server -> Online Riders Pool)
   */
  broadcastDispatch(dispatchData: DispatchBroadcastPayload) {
    const payload = {
      event: 'dispatch:broadcast',
      data: dispatchData,
    };
    this.server.to('riders_pool').emit('dispatch:broadcast', payload);
    this.logger.log(`Emitted [dispatch:broadcast] to riders_pool for order ${dispatchData.orderNumber || dispatchData.orderId}`);
  }

  /**
   * Event: dispatch:escalated (Server -> Admin HQ)
   * Alert dispatcher when an order is aging without rider acceptance
   */
  notifyDispatchEscalated(escalationData: {
    orderId: string;
    orderNumber: string;
    tier: number;
    agingSeconds: number;
    searchRadiusKm: number;
    vendorName?: string;
  }) {
    const payload = {
      event: 'dispatch:escalated',
      data: escalationData,
    };
    this.server.to('admin_hq').emit('dispatch:escalated', payload);
    this.logger.warn(
      `Emitted [dispatch:escalated] (Tier ${escalationData.tier}) for order ${escalationData.orderNumber} (Aging: ${escalationData.agingSeconds}s, Radius: ${escalationData.searchRadiusKm}km)`,
    );
  }
}

