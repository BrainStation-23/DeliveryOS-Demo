import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function buildContext(user: { role?: UserRole } | undefined) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

function buildGuard(metadata: UserRole[] | undefined) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(metadata),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows any authenticated user when no role metadata is present', () => {
    const guard = buildGuard(undefined);

    expect(guard.canActivate(buildContext({ role: UserRole.CUSTOMER }))).toBe(true);
  });

  it('throws when no user is attached to the request', () => {
    const guard = buildGuard([UserRole.VENDOR_ADMIN]);

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });

  it('SUPER_ADMIN bypasses every role restriction', () => {
    const guard = buildGuard([UserRole.VENDOR_ADMIN, UserRole.RIDER]);

    expect(guard.canActivate(buildContext({ role: UserRole.SUPER_ADMIN }))).toBe(true);
  });

  it('allows a user whose role is in the required set', () => {
    const guard = buildGuard([UserRole.VENDOR_ADMIN, UserRole.RIDER]);

    expect(guard.canActivate(buildContext({ role: UserRole.RIDER }))).toBe(true);
  });

  it('denies a user whose role is outside the required set with 403', () => {
    const guard = buildGuard([UserRole.VENDOR_ADMIN]);

    expect(() => guard.canActivate(buildContext({ role: UserRole.RIDER }))).toThrow(
      /Access denied: required role/,
    );
  });
});
