import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { isProduction } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};

type MongoServerError = { code?: number; keyValue?: Record<string, unknown> };
type BodyParserError = { type?: string; status?: number };

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof mongoose.Error.ValidationError) {
    return ApiError.validation(
      Object.values(error.errors).map((issue) => ({ path: issue.path, message: issue.message })),
    );
  }

  if (error instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for "${error.path}"`);
  }

  const mongoError = error as MongoServerError;
  if (mongoError?.code === 11000) {
    const fields = Object.keys(mongoError.keyValue ?? {});
    return ApiError.conflict(
      `A record with this ${fields.join(', ') || 'value'} already exists`,
      fields.map((field) => ({ path: `body.${field}`, message: 'Already in use' })),
    );
  }

  const bodyError = error as BodyParserError;
  if (bodyError?.type === 'entity.parse.failed') return ApiError.badRequest('Malformed JSON body');
  if (bodyError?.type === 'entity.too.large') {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }

  if (error instanceof mongoose.Error.MongooseServerSelectionError) {
    return new ApiError(503, 'SERVICE_UNAVAILABLE', 'Database is temporarily unavailable');
  }

  return new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const apiError = toApiError(error);

  if (apiError.status >= 500) {
    logger.error({ err: error, method: req.method, url: req.originalUrl }, 'Unhandled error');
  }

  res.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details && { details: apiError.details }),
      ...(!isProduction &&
        apiError.status >= 500 &&
        error instanceof Error && { stack: error.stack }),
    },
  });
};
