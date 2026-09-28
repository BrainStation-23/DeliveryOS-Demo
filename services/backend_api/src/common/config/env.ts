export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getAllowedOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001,http://localhost:8080')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
