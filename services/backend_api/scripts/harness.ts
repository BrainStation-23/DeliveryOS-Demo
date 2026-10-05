import { config as loadEnv } from 'dotenv';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

// Load environment variables matching repository config
loadEnv({ path: ['../../.env', '.env'] });

export const TEST_OTP = '123456';

export const TEST_PHONES = {
  SUPER_ADMIN: '+8801700000001',
  VENDOR_BRANCH_MANAGER: '+8801700000002',
  VENDOR_BRAND_OWNER: '+8801700000003',
  RIDER: '+8801700000004',
  CUSTOMER: '+8801700000005',
} as const;

export const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000/api/v1';
export const WS_BASE = process.env.WS_BASE_URL || 'http://localhost:4000/events';

export interface RequestJsonResult<T = unknown> {
  status: number;
  ok: boolean;
  data: T;
}

/**
 * Standard HTTP JSON request helper for integration test scripts.
 */
export async function requestJson<T = unknown>(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
    token?: string;
    headers?: Record<string, string>;
  },
): Promise<RequestJsonResult<T>> {
  const method = options?.method || (options?.body ? 'POST' : 'GET');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
  };
  if (options?.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return {
    status: res.status,
    ok: res.ok,
    data: json as T,
  };
}

/**
 * Standard phone OTP login helper.
 */
export async function login(
  phone: string,
  role?: string,
  apiBase: string = API_BASE,
): Promise<{ accessToken: string; refreshToken?: string; user: Record<string, unknown> }> {
  // Request OTP
  await requestJson(`${apiBase}/auth/otp/request`, {
    method: 'POST',
    body: { phone, role },
  });

  // Verify OTP
  const verifyRes = await requestJson<{
    data?: { accessToken: string; refreshToken?: string; user: Record<string, unknown> };
  }>(`${apiBase}/auth/otp/verify`, {
    method: 'POST',
    body: { phone, otp: TEST_OTP },
  });

  if (!verifyRes.ok || !verifyRes.data?.data?.accessToken) {
    throw new Error(
      `Login failed for ${phone}: status ${verifyRes.status}, response: ${JSON.stringify(verifyRes.data)}`,
    );
  }

  return {
    accessToken: verifyRes.data.data.accessToken,
    refreshToken: verifyRes.data.data.refreshToken,
    user: verifyRes.data.data.user,
  };
}

/**
 * Wraps execution inside an ephemeral NestJS application instance,
 * guaranteeing graceful teardown and socket unsubscription cleanup.
 */
export async function withApp<T>(
  fn: (ctx: { app: INestApplication; port: number; url: string }) => Promise<T>,
  options?: { port?: number; prefix?: string },
): Promise<T> {
  const port = options?.port || 4099;
  const prefix = options?.prefix || 'api/v1';

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix(prefix);
  await app.listen(port);

  const url = `http://localhost:${port}/${prefix}`;

  try {
    return await fn({ app, port, url });
  } finally {
    const onShutdownRejection = (reason: unknown) => {
      console.warn('   ⚠ shutdown warning (ignored):', reason instanceof Error ? reason.message : String(reason));
    };
    process.on('unhandledRejection', onShutdownRejection);
    process.on('uncaughtException', onShutdownRejection);
    await app.close().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 50));
    process.off('unhandledRejection', onShutdownRejection);
    process.off('uncaughtException', onShutdownRejection);
  }
}
