import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import prisma from '~/prisma';
import { ApiKeyLogAction } from '@prisma/client';

// API Key-specific rate limiter: 10 requests per second per API key
export const apiRateLimit = rateLimit({
  windowMs: 1000, // 1 second
  max: 10, // 10 requests per second

  // Use raw API key string for rate limiting (before authentication)
  keyGenerator: (req: any) => {
    // Use the raw API key if available, otherwise fall back to IP with proper IPv6 handling
    return req.rawApiKey || ipKeyGenerator(req.ip);
  },

  // Custom handler to log which API key exceeded the limit
  handler: async (req: any, res, next) => {
    const authHeader = req.headers.authorization;

    const rawApiKey = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null; // Remove 'Bearer ' prefix

    if (rawApiKey) {
      // Try to find the API key in database for logging (but don't fail if not found)
      try {
        const apiKey = await prisma.apiKey.findFirst({
          where: {
            private_key: rawApiKey,
            active: true,
            deleted_at: null,
          },
          select: { id: true, name: true },
        });

        if (apiKey) {
          await prisma.apiKeyLog.create({
            data: {
              api_key_id: apiKey.id,
              action: ApiKeyLogAction.RATE_LIMITED,
              ip_address: req.ip,
              user_agent: req.headers['user-agent'],
              endpoint: req.originalUrl,
              status_code: 429,
            },
          });

          console.warn(`API Key ${apiKey.id} (${apiKey.name}) exceeded rate limit on ${req.originalUrl}`);
        } else {
          console.warn(`Unknown/invalid API Key exceeded rate limit on ${req.originalUrl} from IP ${req.ip}`);
        }
      } catch (error) {
        console.error('Failed to log rate limit violation:', error);
      }
    } else {
      console.warn(`IP ${req.ip} exceeded rate limit on ${req.originalUrl} (no API key provided)`);
    }

    // Send the rate limit response
    res.status(429).json({
      ok: false,
      error: 'Too many requests, please try again later.',
      message: 'Rate limit exceeded',
      data: null,
    });
  },

  standardHeaders: true,
  legacyHeaders: false,
});
