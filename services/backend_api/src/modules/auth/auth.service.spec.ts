import { AccountStatus, UserRole } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';

const TEST_JWT_SECRET = 'unit-test-jwt-secret-value-32chars';
const TEST_REFRESH_SECRET = 'unit-test-refresh-secret-value-32chars';

function buildService(options: {
  storedOtp?: string | null;
  otpAttempts?: string | null;
  rateLimitAttempts?: string | null;
  roleRequest?: string | null;
  user?: Record<string, unknown> | null;
}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(options.user ?? null),
      create: jest.fn().mockResolvedValue({
        id: 'user-new',
        phone: '+8801700000009',
        fullName: 'New Customer',
        role: UserRole.CUSTOMER,
        status: AccountStatus.ACTIVE,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    rider: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma));
  const redis = {
    get: jest.fn(async (key: string) => {
      if (key === 'otp:+8801700000009') return options.storedOtp ?? null;
      if (key === 'otp_attempts:+8801700000009') return options.otpAttempts ?? null;
      if (key === 'ratelimit:otp:+8801700000009') return options.rateLimitAttempts ?? null;
      if (key === 'role_req:+8801700000009') return options.roleRequest ?? null;
      return null;
    }),
    getdel: jest.fn(async (_key: string): Promise<string | null> => {
      return null;
    }),
    zrem: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };
  const smsService = { sendOtp: jest.fn().mockResolvedValue(undefined) };

  const service = new AuthService(prisma as never, redis as never, smsService);

  return { service, prisma, redis, smsService };
}

describe('AuthService - requestOtp', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = TEST_REFRESH_SECRET;
    delete process.env.SMS_PROVIDER;
    delete process.env.SMS_MOCK_STATIC_OTP;
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
  });

  it('issues an OTP with 2-minute TTL and increments the rate-limit counter', async () => {
    const { service, redis, smsService } = buildService({});

    const result = await service.requestOtp({ phone: '+8801700000009' });

    expect(result.retryAfterSeconds).toBe(60);
    expect(redis.set).toHaveBeenCalledWith('otp:+8801700000009', expect.any(String), 120);
    expect(redis.set).toHaveBeenCalledWith('ratelimit:otp:+8801700000009', '1', 300);
    expect(smsService.sendOtp).toHaveBeenCalledWith('+8801700000009', expect.any(String));
  });

  it('blocks the 4th OTP request within the rate-limit window (429)', async () => {
    const { service, redis, smsService } = buildService({ rateLimitAttempts: '3' });

    await expect(service.requestOtp({ phone: '+8801700000009' })).rejects.toMatchObject({
      status: 429,
    });
    expect(smsService.sendOtp).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('uses the configured static OTP only when SMS_PROVIDER is mock', async () => {
    process.env.SMS_PROVIDER = 'mock';
    process.env.SMS_MOCK_STATIC_OTP = '123456';
    const { service, redis, smsService } = buildService({});

    await service.requestOtp({ phone: '+8801700000009' });

    expect(redis.set).toHaveBeenCalledWith('otp:+8801700000009', '123456', 120);
    expect(smsService.sendOtp).toHaveBeenCalledWith('+8801700000009', '123456');
  });

  it('caches the requested role for new-user self-signup', async () => {
    const { service, redis } = buildService({});

    await service.requestOtp({ phone: '+8801700000009', role: UserRole.RIDER });

    expect(redis.set).toHaveBeenCalledWith('role_req:+8801700000009', 'RIDER', 300);
  });

  it('blocks OTP request for suspended accounts', async () => {
    const { service, smsService } = buildService({
      user: { id: 'user-1', status: AccountStatus.SUSPENDED },
    });

    await expect(service.requestOtp({ phone: '+8801700000009' })).rejects.toThrow(
      'Your account has been suspended',
    );
    expect(smsService.sendOtp).not.toHaveBeenCalled();
  });

  it('blocks OTP request for suspended accounts with custom reason', async () => {
    const { service, smsService } = buildService({
      user: { id: 'user-1', status: AccountStatus.SUSPENDED, suspensionReason: 'Payment chargeback investigation' },
    });

    await expect(service.requestOtp({ phone: '+8801700000009' })).rejects.toThrow(
      'Payment chargeback investigation',
    );
    expect(smsService.sendOtp).not.toHaveBeenCalled();
  });
});

describe('AuthService - verifyOtp', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = TEST_REFRESH_SECRET;
    delete process.env.SMS_PROVIDER;
    delete process.env.SMS_MOCK_STATIC_OTP;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    process.env.NODE_ENV = 'test';
  });

  const phone = '+8801700000009';
  const activeUser = {
    id: 'user-1',
    phone,
    fullName: 'Existing Customer',
    role: UserRole.CUSTOMER,
    status: AccountStatus.ACTIVE,
  };

  it('rejects an OTP that does not match the cached code', async () => {
    const { service, redis } = buildService({ storedOtp: '111111', user: activeUser });

    await expect(service.verifyOtp({ phone, otp: '999999' })).rejects.toThrow(
      'Invalid or expired OTP code',
    );
    expect(redis.set).toHaveBeenCalledWith('otp_attempts:+8801700000009', '1', 120);
  });

  it('locks out and invalidates the OTP after 5 failed verification attempts', async () => {
    const { service, redis } = buildService({
      storedOtp: '111111',
      otpAttempts: '5',
      user: activeUser,
    });

    await expect(service.verifyOtp({ phone, otp: '111111' })).rejects.toThrow(
      'Too many invalid attempts. Please request a new OTP.',
    );
    expect(redis.del).toHaveBeenCalledWith('otp:+8801700000009');
    expect(redis.del).toHaveBeenCalledWith('otp_attempts:+8801700000009');
  });

  it('does not accept the static OTP when SMS_PROVIDER is a real provider', async () => {
    process.env.SMS_PROVIDER = 'ssl_wireless';
    process.env.SMS_MOCK_STATIC_OTP = '123456';
    const { service } = buildService({ storedOtp: null, user: activeUser });

    await expect(service.verifyOtp({ phone, otp: '123456' })).rejects.toThrow(
      'Invalid or expired OTP code',
    );
  });

  it('returns access + rotating refresh tokens and clears OTP state on success', async () => {
    const { service, prisma, redis } = buildService({ storedOtp: '654321', user: activeUser });

    const result = await service.verifyOtp({ phone, otp: '654321' });

    expect(result.user.id).toBe('user-1');
    expect(result.user.role).toBe(UserRole.CUSTOMER);

    const access = jwt.verify(result.accessToken, TEST_JWT_SECRET) as { sub: string; type: string };
    const refresh = jwt.verify(result.refreshToken, TEST_REFRESH_SECRET) as {
      sub: string;
      type: string;
      jti: string;
    };
    expect(access.type).toBe('access');
    expect(access.sub).toBe('user-1');
    expect(refresh.type).toBe('refresh');
    expect(refresh.sub).toBe('user-1');
    expect(refresh.jti).toEqual(expect.any(String));

    expect(redis.del).toHaveBeenCalledWith('otp:+8801700000009');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('clamps new-user self-signup roles to CUSTOMER even with a stale admin role cached', async () => {
    const { service, prisma } = buildService({ storedOtp: '654321', roleRequest: 'SUPER_ADMIN' });

    await service.verifyOtp({ phone, otp: '654321' });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: UserRole.CUSTOMER, status: AccountStatus.ACTIVE }),
      }),
    );
  });

  it('creates pending-approval riders with a rider profile on first login', async () => {
    const { service, prisma, riderCreate } = (() => {
      const built = buildService({ storedOtp: '654321', roleRequest: 'RIDER' });
      return { ...built, riderCreate: built.prisma.rider.create };
    })();

    await service.verifyOtp({ phone, otp: '654321' });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: UserRole.RIDER,
          status: AccountStatus.PENDING_APPROVAL,
        }),
      }),
    );
    expect(riderCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-new', isOnline: false }),
    });
  });

  it('blocks login for accounts pending admin approval', async () => {
    const { service } = buildService({
      storedOtp: '654321',
      user: { ...activeUser, status: AccountStatus.PENDING_APPROVAL },
    });

    await expect(service.verifyOtp({ phone, otp: '654321' })).rejects.toMatchObject({
      status: 403,
    });
  });

  it('blocks login for suspended accounts', async () => {
    const { service } = buildService({
      storedOtp: '654321',
      user: { ...activeUser, status: AccountStatus.SUSPENDED },
    });

    await expect(service.verifyOtp({ phone, otp: '654321' })).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe('AuthService - refreshTokens rotation', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = TEST_REFRESH_SECRET;
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
  });

  const activeUser = {
    id: 'user-1',
    phone: '+8801700000009',
    fullName: 'Existing Customer',
    role: UserRole.CUSTOMER,
    status: AccountStatus.ACTIVE,
  };

  function mintRefreshToken(payload: object) {
    return jwt.sign(payload, TEST_REFRESH_SECRET, { expiresIn: '30d' });
  }

  it('rejects access tokens presented for refresh', async () => {
    const accessToken = jwt.sign({ sub: 'user-1', type: 'access' }, TEST_REFRESH_SECRET);
    const { service } = buildService({ user: activeUser });

    await expect(service.refreshTokens(accessToken)).rejects.toThrow('Malformed refresh token');
  });

  it('rejects refresh tokens whose jti was already revoked (single-use)', async () => {
    const token = mintRefreshToken({ sub: 'user-1', type: 'refresh', jti: 'revoked-jti' });
    const { service } = buildService({ user: activeUser });

    // Simulate the revocation store having no entry for this jti.
    await expect(service.refreshTokens(token)).rejects.toThrow(
      'Refresh token has been revoked',
    );
  });

  it('rotates to a fresh token pair and revokes the presented jti', async () => {
    const presentedJti = 'presented-jti';
    const token = mintRefreshToken({ sub: 'user-1', type: 'refresh', jti: presentedJti });
    const { service, redis } = (() => {
      const built = buildService({ user: activeUser });
      built.redis.getdel = jest.fn(async (key: string) =>
        key === `auth:refresh:${presentedJti}` ? 'user-1' : null,
      );
      return built;
    })();

    const result = await service.refreshTokens(token);

    const access = jwt.verify(result.accessToken, TEST_JWT_SECRET) as { sub: string };
    const refresh = jwt.verify(result.refreshToken, TEST_REFRESH_SECRET) as { jti: string };
    expect(access.sub).toBe('user-1');
    expect(refresh.jti).not.toBe(presentedJti);
    expect(refresh.jti).toEqual(expect.any(String));

    expect(redis.getdel).toHaveBeenCalledWith(`auth:refresh:${presentedJti}`);
    expect(redis.set).toHaveBeenCalledWith(
      `auth:refresh:${refresh.jti}`,
      'user-1',
      expect.any(Number),
    );
  });

  it('rejects concurrent replay attempt with the same refresh token', async () => {
    const presentedJti = 'concurrent-jti';
    const token = mintRefreshToken({ sub: 'user-1', type: 'refresh', jti: presentedJti });
    const { service } = (() => {
      const built = buildService({ user: activeUser });
      let callCount = 0;
      built.redis.getdel = jest.fn(async (key: string) => {
        if (key === `auth:refresh:${presentedJti}`) {
          callCount++;
          // First call succeeds, second concurrent call gets null (key already consumed)
          return callCount === 1 ? 'user-1' : null;
        }
        return null;
      });
      return built;
    })();

    // Winner succeeds
    const firstCall = await service.refreshTokens(token);
    expect(firstCall.accessToken).toBeDefined();

    // Loser fails with revocation exception
    await expect(service.refreshTokens(token)).rejects.toThrow('Refresh token has been revoked');
  });

  it('revokes the stored jti when the user is no longer active', async () => {
    const presentedJti = 'stale-jti';
    const token = mintRefreshToken({ sub: 'user-1', type: 'refresh', jti: presentedJti });
    const { service, redis } = (() => {
      const built = buildService({
        user: { ...activeUser, status: AccountStatus.SUSPENDED },
      });
      built.redis.getdel = jest.fn(async (key: string) =>
        key === `auth:refresh:${presentedJti}` ? 'user-1' : null,
      );
      return built;
    })();

    await expect(service.refreshTokens(token)).rejects.toThrow(
      'Your account has been suspended',
    );
    expect(redis.getdel).toHaveBeenCalledWith(`auth:refresh:${presentedJti}`);
  });

  it('rejects garbage tokens without leaking errors', async () => {
    const { service } = buildService({ user: activeUser });

    await expect(service.refreshTokens('not-a-jwt')).rejects.toThrow(
      'Invalid or expired refresh token',
    );
  });
});

describe('AuthService - logout', () => {
  beforeEach(() => {
    process.env.JWT_REFRESH_SECRET = TEST_REFRESH_SECRET;
  });

  afterEach(() => {
    delete process.env.JWT_REFRESH_SECRET;
  });

  it('revokes the presented refresh jti, purges user cache, and clears FCM token', async () => {
    const { service, redis, prisma } = buildService({});
    const token = jwt.sign({ sub: 'user-1', type: 'refresh', jti: 'logout-jti' }, TEST_REFRESH_SECRET);

    await expect(service.logout(token)).resolves.toBeUndefined();
    expect(redis.del).toHaveBeenCalledWith('auth:refresh:logout-jti');
    expect(redis.del).toHaveBeenCalledWith('auth:user:user-1');
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { fcmToken: null },
    });
  });

  it('is idempotent for invalid or expired tokens', async () => {
    const { service, redis } = buildService({});

    await expect(service.logout('garbage')).resolves.toBeUndefined();
    expect(redis.del).not.toHaveBeenCalled();
  });
});
