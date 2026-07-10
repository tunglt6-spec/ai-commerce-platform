export interface AppConfig {
  nodeEnv: string;
  port: number;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: number;
    refreshTtl: number;
  };
  corsOrigins: string[];
  rateLimitPerMin: number;
  ai: {
    baseUrl: string;
    apiKey: string;
    modelDefault: string;
    modelContent: string;
    modelStrategy: string;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.BACKEND_PORT ?? '3001', 10),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    accessTtl: parseInt(process.env.JWT_ACCESS_TTL ?? '900', 10),
    refreshTtl: parseInt(process.env.JWT_REFRESH_TTL ?? '604800', 10),
  },
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  rateLimitPerMin: parseInt(process.env.RATE_LIMIT_PER_MIN ?? '120', 10),
  ai: {
    baseUrl: process.env.AI_GATEWAY_BASE_URL ?? '',
    apiKey: process.env.AI_GATEWAY_API_KEY ?? '',
    modelDefault: process.env.AI_MODEL_DEFAULT ?? 'gemini-flash',
    modelContent: process.env.AI_MODEL_CONTENT ?? 'qwen-3',
    modelStrategy: process.env.AI_MODEL_STRATEGY ?? 'claude-sonnet',
  },
});
