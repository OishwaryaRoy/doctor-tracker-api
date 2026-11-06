import {
  ipKeyGenerator,
  rateLimit,
  type ClientRateLimitInfo,
  type Options,
  type Store,
} from 'express-rate-limit';
import mongoose from 'mongoose';

type HitDocument = { _id: string; hits: number; expiresAt: Date };

class MongoRateLimitStore implements Store {
  private windowMs = 60_000;
  private indexReady: Promise<unknown> | null = null;
  readonly prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  init(options: Options) {
    this.windowMs = options.windowMs;
  }

  private collection() {
    const collection = mongoose.connection.collection<HitDocument>('rate_limits');
    this.indexReady ??= collection
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
      .catch(() => (this.indexReady = null));
    return collection;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const now = new Date();
    const windowExpired = {
      $or: [{ $eq: [{ $type: '$expiresAt' }, 'missing'] }, { $lte: ['$expiresAt', now] }],
    };

    const doc = await this.collection().findOneAndUpdate(
      { _id: this.prefix + key },
      [
        {
          $set: {
            hits: { $cond: [windowExpired, 1, { $add: ['$hits', 1] }] },
            expiresAt: {
              $cond: [windowExpired, new Date(now.getTime() + this.windowMs), '$expiresAt'],
            },
          },
        },
      ],
      { upsert: true, returnDocument: 'after' },
    );

    return { totalHits: doc?.hits ?? 1, resetTime: doc?.expiresAt };
  }

  async decrement(key: string): Promise<void> {
    await this.collection().updateOne(
      { _id: this.prefix + key, hits: { $gt: 0 } },
      { $inc: { hits: -1 } },
    );
  }

  async resetKey(key: string): Promise<void> {
    await this.collection().deleteOne({ _id: this.prefix + key });
  }
}

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return `${ipKeyGenerator(req.ip ?? '')}:${email}`;
  },
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new MongoRateLimitStore('login:'),
  passOnStoreError: true,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
      },
    });
  },
});
