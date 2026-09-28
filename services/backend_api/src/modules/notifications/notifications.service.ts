import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Messaging } from 'firebase-admin/messaging';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { UserRole } from '@prisma/client';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseMessaging: Messaging | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initialize Firebase Admin from a service-account JSON (inline env var or file
   * path). Without it, the service degrades to structured log-only dispatch so
   * local development does not require Firebase credentials.
   */
  async onModuleInit(): Promise<void> {
    const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const credsPath = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!inlineJson && !credsPath) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not configured. Push notifications are log-only.');
      return;
    }

    try {
      const { getApps, initializeApp, cert } = await import('firebase-admin/app');
      const { getMessaging } = await import('firebase-admin/messaging');
      if (!getApps().length) {
        initializeApp({
          credential: cert(credsPath ? credsPath : JSON.parse(inlineJson as string)),
        });
        this.logger.log('Firebase Admin initialized — FCM push is live.');
      }
      this.firebaseMessaging = getMessaging();
    } catch (err) {
      this.logger.error(`Firebase Admin init failed: ${(err as Error).message}. Push notifications are log-only.`);
      this.firebaseMessaging = null;
    }
  }

  /**
   * Register or update the device FCM token for an authenticated user
   */
  async registerDeviceToken(userId: string, dto: RegisterDeviceTokenDto): Promise<{ success: boolean }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        fcmToken: dto.fcmToken,
        devicePlatform: dto.platform || 'mobile',
      },
    });

    this.logger.log(`Device FCM token registered for user ${userId} (Platform: ${dto.platform || 'unknown'})`);
    return { success: true };
  }

  /**
   * Dispatch push notification to a specific user by ID
   */
  async sendToUser(userId: string, payload: PushNotificationPayload): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fcmToken: true, devicePlatform: true, role: true },
    });

    if (!user || !user.fcmToken) {
      this.logger.debug(`User ${userId} has no registered FCM token. Skipping remote push notification.`);
      return false;
    }

    return this.dispatchPush([user.fcmToken], payload);
  }

  /**
   * Dispatch push notification to multiple users
   */
  async sendToUsers(userIds: string[], payload: PushNotificationPayload): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        fcmToken: { not: null },
      },
      select: { fcmToken: true },
    });

    const tokens = users.map((u) => u.fcmToken).filter((t): t is string => Boolean(t));
    if (tokens.length === 0) return 0;

    await this.dispatchPush(tokens, payload);
    return tokens.length;
  }

  /**
   * Dispatch push notification to all users with a specific role
   */
  async sendToRole(role: UserRole, payload: PushNotificationPayload): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: {
        role,
        fcmToken: { not: null },
      },
      select: { fcmToken: true },
    });

    const tokens = users.map((u) => u.fcmToken).filter((t): t is string => Boolean(t));
    if (tokens.length === 0) return 0;

    await this.dispatchPush(tokens, payload);
    return tokens.length;
  }

  /**
   * Low-level dispatcher: real FCM multicast when Firebase is configured,
   * structured log-only otherwise (development).
   */
  private async dispatchPush(tokens: string[], payload: PushNotificationPayload): Promise<boolean> {
    this.logger.log(
      `[Push Notification] Dispatched to ${tokens.length} target(s) | Title: "${payload.title}" | Body: "${payload.body}" | Data: ${JSON.stringify(payload.data || {})}`,
    );

    if (!this.firebaseMessaging) {
      return true;
    }

    try {
      const response = await this.firebaseMessaging.sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data || {},
        android: { priority: 'high' },
      });
      if (response.failureCount > 0) {
        this.logger.warn(
          `FCM dispatch partial failure: ${response.failureCount}/${tokens.length} failed (first: ${response.responses.find((r) => !r.success)?.error?.message})`,
        );
      }
      return response.successCount > 0;
    } catch (err) {
      this.logger.error(`Error sending push notification via Firebase: ${(err as Error).message}`);
      return false;
    }
  }
}
