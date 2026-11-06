import { z } from 'zod';
import { dateRangeQuery, optionalQuery, refineDateRange } from '../../utils/zod.js';

export const INTERVALS = ['day', 'week', 'month'] as const;
export type Interval = (typeof INTERVALS)[number];

function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const overviewQuery = z
  .object({
    ...dateRangeQuery,
    interval: optionalQuery(z.enum(INTERVALS)),
    tz: optionalQuery(z.string().max(64).refine(isValidTimeZone, 'Unknown time zone')).transform(
      (value) => value ?? 'UTC',
    ),
  })
  .superRefine(refineDateRange);

export type OverviewQuery = z.infer<typeof overviewQuery>;
