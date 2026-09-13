import dns from 'node:dns';
import mongoose from 'mongoose';

/** Connect once at startup and fail fast if the database is unavailable. */
export async function connectDatabase() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not configured. Copy .env.example to .env and set it.');
  }

  try {
    if (process.env.MONGO_DNS_SERVER) {
      dns.setServers([process.env.MONGO_DNS_SERVER]);
    }

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (error) {
    const errorText = `${error.message} ${error?.cause?.message || ''}`;
    if (
      error?.cause?.code === 'ENOTFOUND' ||
      error?.cause?.code === 'ETIMEOUT' ||
      error?.code === 'ENOTFOUND' ||
      error?.code === 'ETIMEOUT' ||
      errorText.includes('querySrv')
    ) {
      throw new Error(
        'MongoDB Atlas DNS lookup failed. Check your network/VPN DNS settings and copy the current hostname from MongoDB Atlas into MONGO_URI.'
      );
    }

    throw new Error(`MongoDB connection failed: ${error.message}`);
  }
}
