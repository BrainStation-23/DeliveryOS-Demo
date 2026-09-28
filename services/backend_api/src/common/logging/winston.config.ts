import winston from 'winston';
import { requestContext } from './request-context';

export function createAppLogger(): winston.Logger {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format((info) => {
        const store = requestContext.getStore();
        if (store?.requestId) {
          info.requestId = store.requestId;
        }
        return info;
      })(),
      winston.format.timestamp(),
      winston.format.json(),
    ),
    transports: [new winston.transports.Console()],
  });
}
