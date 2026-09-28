const API = 'http://localhost:4000/api/v1';

async function login(phone) {
  const res = await fetch(`${API}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp: '123456' }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Login failed: ${body?.message || res.status}`);
  return body.data;
}

async function post(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function getMe(token) {
  const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  return res.status;
}

(async () => {
  const phone = '+8801700000021';
  const session = await login(phone);
  console.log('1. login OK — has access+refresh:', Boolean(session.accessToken && session.refreshToken));

  // Access token works
  console.log('2. /auth/me with access token:', await getMe(session.accessToken), '(expect 200)');

  // Refresh token must NOT work as an access token
  console.log('3. /auth/me with refresh token:', await getMe(session.refreshToken), '(expect 401)');

  // Rotate
  const refresh1 = await post('/auth/refresh', { refreshToken: session.refreshToken });
  const pair1 = refresh1.body?.data;
  console.log('4. /auth/refresh:', refresh1.status, '(expect 200) — new pair:', Boolean(pair1?.accessToken && pair1?.refreshToken));

  // Old refresh token must now be revoked (rotation)
  const replay = await post('/auth/refresh', { refreshToken: session.refreshToken });
  console.log('5. replay of old refresh token:', replay.status, '(expect 401 — rotation revoked it)');

  // Logout revokes the new refresh token
  await post('/auth/logout', { refreshToken: pair1.refreshToken });
  const afterLogout = await post('/auth/refresh', { refreshToken: pair1.refreshToken });
  console.log('6. refresh after logout:', afterLogout.status, '(expect 401)');

  // Tampered/foreign refresh tokens are rejected
  const tampered = await post('/auth/refresh', { refreshToken: 'abc.def.ghi' });
  console.log('7. tampered refresh token:', tampered.status, '(expect 400/401)');

  const allGood =
    Boolean(session.accessToken && session.refreshToken) &&
    (await getMe(session.accessToken)) === 200 &&
    (await getMe(session.refreshToken)) === 401 &&
    refresh1.status === 200 &&
    replay.status === 401 &&
    afterLogout.status === 401 &&
    tampered.status >= 400;

  console.log(allGood ? '\n✅ AUTH REFRESH LIFECYCLE VERIFIED' : '\n❌ AUTH REFRESH LIFECYCLE FAILED');
  process.exit(allGood ? 0 : 1);
})().catch((err) => {
  console.error('Harness error:', err.message);
  process.exit(1);
});
