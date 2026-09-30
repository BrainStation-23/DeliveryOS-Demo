import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

async function testHealthEndpoint() {
  console.log('Testing GET /api/v1/health endpoint...');
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  const port = 4099;
  await app.listen(port);

  try {
    const res = await fetch(`http://localhost:${port}/api/v1/health`);
    const data = await res.json();
    console.log('Health check response:', JSON.stringify(data, null, 2));

    if (res.status !== 200) {
      throw new Error(`Expected status 200, got ${res.status}`);
    }
    if (data.status !== 'healthy') {
      throw new Error(`Expected status 'healthy', got '${data.status}'`);
    }
    if (data.services.database !== 'up' || data.services.redis !== 'up') {
      throw new Error('Expected both database and redis to be up');
    }

    console.log('✅ Health check verification PASSED: Database and Redis are healthy!');
  } finally {
    // socket.io's redis-adapter leaves floating punsubscribe rejections during
    // shutdown; scope a handler to the teardown window so a passing suite exits 0.
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

testHealthEndpoint().catch((err) => {
  console.error('❌ Health check test failed:', err);
  process.exit(1);
});
