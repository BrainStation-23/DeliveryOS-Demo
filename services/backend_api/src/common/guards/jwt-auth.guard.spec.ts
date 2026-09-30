import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from './jwt-auth.guard';

const TEST_JWT_SECRET = 'unit-test-jwt-secret-value-32chars';

const activeUser = {
  id: 'user-1',
  phone: '+8801700000009',
  role: 'CUSTOMER',
  status: 'ACTIVE',
  vendorStaff: null,
  rider: null,
};

function buildGuard(options: { cachedUser?: string | null } = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(activeUser),
    },
  };
  const redis = {
    get: jest.fn().mockResolvedValue(options.cachedUser ?? null),
    set: jest.fn().mockResolvedValue('OK'),
  };
  const guard = new JwtAuthGuard(prisma as never, redis as never);
  const makeContext = (headers: Record<string, string>) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    }) as unknown as ExecutionContext;

  return { guard, prisma, redis, makeContext };
}

describe('JwtAuthGuard', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it('rejects requests without an Authorization header', async () => {
    const { guard, makeContext } = buildGuard();

    await expect(guard.canActivate(makeContext({}))).rejects.toThrow('Missing or invalid');
  });

  it('rejects non-Bearer schemes', async () => {
    const { guard, makeContext } = buildGuard();

    await expect(guard.canActivate(makeContext({ authorization: 'Basic abc' }))).rejects.toThrow(
      'Missing or invalid',
    );
  });

  it('rejects refresh tokens used as API access tokens with a precise message', async () => {
    const { guard, makeContext } = buildGuard();
    const refresh = jwt.sign({ sub: 'user-1', type: 'refresh', jti: 'j-1' }, TEST_JWT_SECRET);

    await expect(
      guard.canActivate(makeContext({ authorization: `Bearer ${refresh}` })),
    ).rejects.toThrow('Refresh tokens cannot be used for API access');
  });

  it('attaches the active user from the database and seeds the 30s cache', async () => {
    const { guard, prisma, redis } = buildGuard();
    const token = jwt.sign({ sub: 'user-1', role: 'CUSTOMER', type: 'access' }, TEST_JWT_SECRET);

    const request: { headers: Record<string, string>; user?: unknown } = {
      headers: { authorization: `Bearer ${token}` },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      include: { vendorStaff: true, rider: true },
    });
    expect(request.user).toMatchObject({ id: 'user-1', status: 'ACTIVE' });
    expect(redis.set).toHaveBeenCalledWith(
      'auth:user:user-1',
      expect.any(String),
      30,
    );
  });

  it('serves repeat requests from cache without hitting the database', async () => {
    const { guard, prisma, makeContext } = buildGuard({
      cachedUser: JSON.stringify(activeUser),
    });
    const token = jwt.sign({ sub: 'user-1', role: 'CUSTOMER', type: 'access' }, TEST_JWT_SECRET);

    await expect(guard.canActivate(makeContext({ authorization: `Bearer ${token}` }))).resolves.toBe(
      true,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('falls back to the database when cached JSON is corrupted', async () => {
    const { guard, prisma, makeContext } = buildGuard({ cachedUser: '{not-json' });
    const token = jwt.sign({ sub: 'user-1', role: 'CUSTOMER', type: 'access' }, TEST_JWT_SECRET);

    await expect(guard.canActivate(makeContext({ authorization: `Bearer ${token}` }))).resolves.toBe(
      true,
    );
    expect(prisma.user.findUnique).toHaveBeenCalled();
  });

  it('rejects users whose account is no longer ACTIVE', async () => {
    const { guard, prisma, makeContext } = buildGuard();
    prisma.user.findUnique.mockResolvedValue({ ...activeUser, status: 'SUSPENDED' });
    const token = jwt.sign({ sub: 'user-1', role: 'CUSTOMER', type: 'access' }, TEST_JWT_SECRET);

    // The guard collapses every failure into one generic message to avoid
    // leaking account-state details to unauthenticated callers.
    await expect(
      guard.canActivate(makeContext({ authorization: `Bearer ${token}` })),
    ).rejects.toThrow('Invalid or expired token');
    expect(prisma.user.findUnique).toHaveBeenCalled();
  });

  it('rejects tokens signed with the wrong secret as generic invalid', async () => {
    const { guard, makeContext } = buildGuard();
    const forged = jwt.sign({ sub: 'user-1', role: 'CUSTOMER', type: 'access' }, 'attacker-secret');

    await expect(
      guard.canActivate(makeContext({ authorization: `Bearer ${forged}` })),
    ).rejects.toThrow(UnauthorizedException);
  });
});
