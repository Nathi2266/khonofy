import 'dotenv/config';

export const PRODUCTION_FRONTEND_URL =
  'https://polite-smoke-0f9de4610.7.azurestaticapps.net';

const isAzureAppService = Boolean(process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_HOSTNAME);

const nodeEnv =
  process.env.NODE_ENV
  || (isAzureAppService ? 'production' : 'development');

function buildCorsOrigins() {
  const origins = new Set();

  const frontendUrl =
    process.env.FRONTEND_URL
    || (nodeEnv === 'production' ? PRODUCTION_FRONTEND_URL : 'http://localhost:5173');
  origins.add(frontendUrl);
  origins.add(PRODUCTION_FRONTEND_URL);

  if (process.env.CORS_ORIGINS) {
    for (const origin of process.env.CORS_ORIGINS.split(',')) {
      const trimmed = origin.trim();
      if (trimmed) origins.add(trimmed);
    }
  }

  return [...origins];
}

export const env = {
  databaseUrl: process.env.DATABASE_URL || '',
  port: Number(process.env.PORT || 3001),
  nodeEnv,
  frontendUrl:
    process.env.FRONTEND_URL
    || (nodeEnv === 'production' ? PRODUCTION_FRONTEND_URL : 'http://localhost:5173'),
  corsOrigins: buildCorsOrigins(),
  jwtSecret: process.env.JWT_SECRET || 'replace-me-in-development',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  emailFrom: process.env.EMAIL_FROM || 'noreply@khonofy.local',
  azureOpenAiApiKey: process.env.AZURE_OPENAI_API_KEY || '',
  azureOpenAiEndpoint: process.env.AZURE_OPENAI_API_ENDPOINT || '',
  azureOpenAiModel: process.env.AZURE_OPENAI_MODEL || '',
  azureOpenAiApiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-10-21',
  base44AppId: process.env.BASE44_APP_ID || '',
  base44ApiKey: process.env.BASE44_API_KEY || '',
  base44ServerUrl: process.env.BASE44_SERVER_URL || 'https://base44.app',
  base44AppBaseUrl: process.env.BASE44_APP_BASE_URL || '',
  imagekitPublicKey: process.env.PUBLIC_KEY || process.env.IMAGEKIT_PUBLIC_KEY || '',
  imagekitPrivateKey: process.env.PRIVATE_KEY || process.env.IMAGEKIT_PRIVATE_KEY || '',
  imagekitUrlEndpoint: process.env.IMAGEEKIT_URL || process.env.IMAGEKIT_URL || '',
  imagekitId: process.env.IMAGEEKIT_ID || process.env.IMAGEKIT_ID || '',
};
