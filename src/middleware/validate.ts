import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { ApiError, type ErrorDetail } from '../utils/ApiError.js';

type Schemas = { body?: z.ZodType; query?: z.ZodType; params?: z.ZodType };

export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const details: ErrorDetail[] = [];
    const validated: NonNullable<typeof req.validated> = {};

    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key];
      if (!schema) continue;

      const result = schema.safeParse(req[key] ?? {});
      if (result.success) {
        validated[key] = result.data;
      } else {
        for (const issue of result.error.issues) {
          details.push({ path: [key, ...issue.path].join('.'), message: issue.message });
        }
      }
    }

    if (details.length > 0) return next(ApiError.validation(details));

    req.validated = validated;
    next();
  };
}

export const input = {
  body: <T>(req: { validated?: { body?: unknown } }) => req.validated?.body as T,
  query: <T>(req: { validated?: { query?: unknown } }) => req.validated?.query as T,
  params: <T>(req: { validated?: { params?: unknown } }) => req.validated?.params as T,
};
