import { Injectable, Logger } from '@nestjs/common';
import { ISmsService } from './sms.interface';

/**
 * SSL Wireless SMS Plus (v3) gateway — Bangladesh.
 * Requires: SMS_SSLW_API_TOKEN, SMS_SSLW_SID. Credentials are read lazily so
 * misconfiguration surfaces only when this provider is actually selected.
 */
@Injectable()
export class SslWirelessSmsService implements ISmsService {
  private readonly logger = new Logger(SslWirelessSmsService.name);
  private readonly apiUrl = 'https://smsplus.sslwireless.com/api/v3/sendSMS';

  async sendOtp(phone: string, otp: string): Promise<boolean> {
    const apiToken = process.env.SMS_SSLW_API_TOKEN;
    const sid = process.env.SMS_SSLW_SID;
    if (!apiToken || !sid) {
      this.logger.error('SSL Wireless SMS not configured: SMS_SSLW_API_TOKEN and SMS_SSLW_SID are required');
      return false;
    }

    const text = `Your DeliveryOS verification code is ${otp}. It expires in 2 minutes.`;
    const url =
      `${this.apiUrl}?api_token=${encodeURIComponent(apiToken)}&sid=${encodeURIComponent(sid)}` +
      `&msisdn=${encodeURIComponent(phone)}&sms_text=${encodeURIComponent(text)}` +
      `&csms_id=${encodeURIComponent(`deliveryos-otp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`)}`;

    try {
      const response = await fetch(url, { method: 'GET' });
      const body = (await response.json()) as { smsinfo?: Array<{ sms_id?: string }>; error?: string };
      if (!response.ok || body.error) {
        this.logger.error(`SSL Wireless SMS send failed (${response.status}): ${body.error || 'unknown error'}`);
        return false;
      }
      this.logger.log(`SSL Wireless OTP dispatched to ${phone.slice(-4).padStart(phone.length, '*')}`);
      return true;
    } catch (err) {
      this.logger.error(`SSL Wireless SMS request error: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }
}
