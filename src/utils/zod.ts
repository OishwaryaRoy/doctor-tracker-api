import { isValidObjectId } from 'mongoose';
import { z } from 'zod';

export const objectId = z
  .string()
  .trim()
  .refine((value) => isValidObjectId(value) && /^[a-f\d]{24}$/i.test(value), 'Invalid id');

export const idParams = z.object({ id: objectId });

export function optionalQuery<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

export function csvEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === '') return undefined;
      const list = (Array.isArray(value) ? value : [value]).flatMap((item) =>
        String(item).split(','),
      );
      const cleaned = [...new Set(list.map((item) => item.trim()).filter(Boolean))];
      return cleaned.length > 0 ? cleaned : undefined;
    },
    z.array(z.enum(values)).optional(),
  );
}

export const pageQuery = {
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: optionalQuery(z.string().trim().max(100)),
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export const dateRangeQuery = {
  from: optionalQuery(z.coerce.date()),
  to: z.preprocess((value) => {
    if (value === '' || value === undefined) return undefined;
    if (typeof value === 'string' && DATE_ONLY.test(value)) {
      return new Date(new Date(value).getTime() + DAY_MS - 1);
    }
    return value;
  }, z.coerce.date().optional()),
};

export function refineDateRange<T extends { from?: Date; to?: Date }>(
  value: T,
  ctx: z.RefinementCtx,
) {
  if (value.from && value.to && value.from > value.to) {
    ctx.addIssue({ code: 'custom', path: ['to'], message: '"to" must be on or after "from"' });
  }
}

export function dateRangeFilter(from?: Date, to?: Date) {
  if (!from && !to) return undefined;
  return { ...(from && { $gte: from }), ...(to && { $lte: to }) };
}

export const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s().-]{7,20}$/, 'Enter a valid phone number');

export const personName = z.string().trim().min(2, 'Must be at least 2 characters').max(100);

export const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));

export function atLeastOneField<T extends z.ZodObject>(schema: T) {
  return schema.refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });
}
