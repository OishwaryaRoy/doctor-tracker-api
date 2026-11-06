export type ErrorDetail = { path: string; message: string };

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'TOO_MANY_REQUESTS'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, details?: ErrorDetail[]) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static validation(details: ErrorDetail[]) {
    return new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', details);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(resource = 'Resource') {
    return new ApiError(404, 'NOT_FOUND', `${resource} not found`);
  }

  static conflict(message: string, details?: ErrorDetail[]) {
    return new ApiError(409, 'CONFLICT', message, details);
  }
}
