import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { idParams } from '../../utils/zod.js';
import * as controller from './patient.controller.js';
import { createPatientSchema, listPatientsQuery, updatePatientSchema } from './patient.schema.js';

export const patientRouter = Router();
const adminOnly = requireRole('admin');

patientRouter
  .route('/')
  .get(validate({ query: listPatientsQuery }), controller.list)
  .post(adminOnly, validate({ body: createPatientSchema }), controller.create);

patientRouter
  .route('/:id')
  .get(validate({ params: idParams }), controller.get)
  .patch(adminOnly, validate({ params: idParams, body: updatePatientSchema }), controller.update)
  .delete(adminOnly, validate({ params: idParams }), controller.remove);
