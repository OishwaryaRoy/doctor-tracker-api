import { Router } from 'express';
import { input, validate } from '../../middleware/validate.js';
import { overviewQuery, type OverviewQuery } from './stats.schema.js';
import * as statsService from './stats.service.js';

export const statsRouter = Router();

statsRouter.get('/overview', validate({ query: overviewQuery }), async (req, res) => {
  res.json({ data: await statsService.getOverview(input.query<OverviewQuery>(req)) });
});
