import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MockSmsService } from './sms/mock-sms.service';
import { SslWirelessSmsService } from './sms/ssl-wireless-sms.service';
import { ISmsService, SMS_SERVICE } from './sms/sms.interface';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: SMS_SERVICE,
      useFactory: (): ISmsService => {
        switch (process.env.SMS_PROVIDER) {
          case 'ssl_wireless':
            return new SslWirelessSmsService();
          default:
            return new MockSmsService();
        }
      },
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
