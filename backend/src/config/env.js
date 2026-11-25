require('dotenv').config();

const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];

for (const key of requiredVars) {
  if (!process.env[key]) {
    console.warn(`[env] Warning: ${key} is not set. Using fallback for local development.`);
  }
}

module.exports = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/cloudpool?schema=public',
  jwtSecret: process.env.JWT_SECRET || 'cloudpool_dev_secret_change_in_prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  defaultRadiusMeters: Number(process.env.DEFAULT_POOL_RADIUS_METERS) || 3000,
  expandedRadiusMeters: Number(process.env.EXPANDED_POOL_RADIUS_METERS) || 5000,
};
