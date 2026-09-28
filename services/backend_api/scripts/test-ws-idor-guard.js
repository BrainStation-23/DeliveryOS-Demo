const { io } = require('socket.io-client');

const API = 'http://localhost:4000/api/v1';

async function login(phone) {
  const res = await fetch(`${API}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp: '123456' }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${phone}: ${body?.message || res.status}`);
  return body.data;
}

(async () => {
  const admin = await login('+8801700000001');
  const res = await fetch(`${API}/admin/orders`, {
    headers: { Authorization: `Bearer ${admin.accessToken}` },
  });
  const body = await res.json();
  const orders = body?.data?.items || body?.data?.orders || body?.data || [];
  const foreign = Array.isArray(orders) ? orders.find((o) => o.id && o.customerId) : null;
  if (!foreign) {
    console.log('NO EXISTING ORDER FOUND — skipping cross-user test');
    process.exit(0);
  }
  console.log(`Target order ${foreign.orderNumber} owned by ${foreign.customerId}`);

  const attacker = await login('+8801700000009');
  console.log(`Attacker ${attacker.user.id} (${attacker.user.role})`);

  const sock = io('http://localhost:4000/events', {
    auth: { token: attacker.accessToken },
    transports: ['websocket'],
  });

  const result = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve('TIMEOUT: no denial received'), 6000);
    sock.on('connected', () => {
      sock.emit('order:join', { orderId: foreign.id });
      sock.on('error', (e) => {
        clearTimeout(timer);
        resolve(`DENIED: ${JSON.stringify(e)}`);
      });
      sock.on('order:joined', (ack) => {
        clearTimeout(timer);
        resolve(`JOINED (VULNERABLE): ${JSON.stringify(ack)}`);
      });
    });
    sock.on('connect_error', (e) => {
      clearTimeout(timer);
      resolve(`CONNECT_ERROR: ${e.message}`);
    });
  });

  console.log(`order:join result: ${result}`);
  sock.close();
  process.exit(0);
})().catch((err) => {
  console.error('Test harness error:', err.message);
  process.exit(1);
});
