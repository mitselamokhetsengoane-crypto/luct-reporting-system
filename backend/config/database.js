const { Pool } = require('pg');
require('dotenv').config();

console.log('🔧 Database Configuration:', {
  using: process.env.DATABASE_URL ? 'DATABASE_URL' : 'individual vars',
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  environment: process.env.NODE_ENV
});

// Database configuration for both local and Render
const poolConfig = process.env.DATABASE_URL 
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    }
  : {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'luct_reporting',
      password: process.env.DB_PASSWORD || 'password',
      port: process.env.DB_PORT || 5432,
      ...(process.env.NODE_ENV === 'production' && {
        ssl: {
          rejectUnauthorized: false
        }
      })
    };

const pool = new Pool(poolConfig);

// Test the connection with better error handling
pool.connect()
  .then((client) => {
    console.log('✅ Connected to PostgreSQL database successfully');
    console.log(`📊 Database: ${process.env.DB_NAME}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    client.release();
  })
  .catch((err) => {
    console.error('❌ Database connection error:', err.message);
    console.error('💡 Connection details:', {
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      port: process.env.DB_PORT
    });
  });

// Enhanced error handling for pool
pool.on('error', (err, client) => {
  console.error('❌ Unexpected database pool error:', err);
});

module.exports = pool;