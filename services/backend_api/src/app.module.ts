import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { StorageModule } from './common/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { VendorModule } from './modules/vendors/vendor.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { OrderModule } from './modules/orders/order.module';
import { VendorStaffModule } from './modules/vendor-staff/vendor-staff.module';
import { RiderModule } from './modules/riders/rider.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { OrderFlowModule } from './modules/order-flow/order-flow.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { GeoModule } from './modules/geo/geo.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { MediaModule } from './modules/media/media.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'test', 'production').required(),
        PORT: Joi.number().default(4000),
        API_PREFIX: Joi.string().default('api/v1'),
        JWT_SECRET: Joi.alternatives().conditional('NODE_ENV', {
          is: 'production',
          then: Joi.string()
            .min(32)
            .required()
            .invalid('deliveryos-jwt-secret-key-32chars-minimum-dev'),
          otherwise: Joi.string().min(32).required(),
        }),
        JWT_REFRESH_SECRET: Joi.alternatives().conditional('NODE_ENV', {
          is: 'production',
          then: Joi.string()
            .min(32)
            .required()
            .invalid(
              'deliveryos-jwt-refresh-secret-key-32chars-min',
              'deliveryos-refresh-secret-key-32chars-dev',
            )
            .disallow(Joi.ref('JWT_SECRET')),
          otherwise: Joi.string().min(32).required(),
        }),
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        SMS_PROVIDER: Joi.alternatives().conditional('NODE_ENV', {
          is: 'production',
          then: Joi.string().required().invalid('mock'),
          otherwise: Joi.string(),
        }),
        SMS_SSLW_API_TOKEN: Joi.alternatives().conditional('SMS_PROVIDER', {
          is: 'ssl_wireless',
          then: Joi.string().required().messages({
            'any.required': 'SMS_SSLW_API_TOKEN is required when SMS_PROVIDER=ssl_wireless',
          }),
          otherwise: Joi.string(),
        }),
        SMS_SSLW_SID: Joi.alternatives().conditional('SMS_PROVIDER', {
          is: 'ssl_wireless',
          then: Joi.string().required().messages({
            'any.required': 'SMS_SSLW_SID is required when SMS_PROVIDER=ssl_wireless',
          }),
          otherwise: Joi.string(),
        }),
        SMS_MOCK_STATIC_OTP: Joi.alternatives().conditional('NODE_ENV', {
          is: 'production',
          then: Joi.string().forbidden(),
          otherwise: Joi.string(),
        }),
        ALLOW_STATIC_OTP: Joi.alternatives().conditional('NODE_ENV', {
          is: 'production',
          then: Joi.string().forbidden(),
          otherwise: Joi.string(),
        }),
        SSLCOMMERZ_BASE_URL: Joi.alternatives().conditional('NODE_ENV', {
          is: 'production',
          then: Joi.string()
            .required()
            .uri()
            .invalid('https://sandbox.sslcommerz.com', 'http://sandbox.sslcommerz.com')
            .messages({
              'any.invalid': 'SSLCOMMERZ_BASE_URL must point to the live gateway in production',
            }),
          otherwise: Joi.string(),
        }),
        CORS_ORIGINS: Joi.string(),
        SENTRY_DSN: Joi.string(),
        LOG_LEVEL: Joi.string(),
      }).unknown(true),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    StorageModule,
    HealthModule,
    AuthModule,
    VendorModule,
    PromotionsModule,
    OrderModule,
    VendorStaffModule,
    RiderModule,
    RealtimeModule,
    OrderFlowModule,
    AdminModule,
    GeoModule,
    NotificationsModule,
    PaymentsModule,
    AddressesModule,
    MediaModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
