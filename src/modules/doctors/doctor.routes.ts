import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { idParams } from '../../utils/zod.js';
import {
  createPatientForDoctorSchema,
  doctorPatientParams,
  listDoctorPatientsQuery,
} from '../patients/patient.schema.js';
import * as controller from './doctor.controller.js';
import {
  createDoctorSchema,
  doctorLookupQuery,
  listDoctorsQuery,
  updateDoctorSchema,
} from './doctor.schema.js';

export const doctorRouter = Router();
const adminOnly = requireRole('admin');

doctorRouter
  .route('/')
  .get(validate({ query: listDoctorsQuery }), controller.list)
  .post(adminOnly, validate({ body: createDoctorSchema }), controller.create);

doctorRouter.get('/lookup', validate({ query: doctorLookupQuery }), controller.lookup);

doctorRouter
  .route('/:id')
  .get(validate({ params: idParams }), controller.get)
  .patch(adminOnly, validate({ params: idParams, body: updateDoctorSchema }), controller.update)
  .delete(adminOnly, validate({ params: idParams }), controller.remove);

doctorRouter
  .route('/:id/patients')
  .get(validate({ params: idParams, query: listDoctorPatientsQuery }), controller.listPatients)
  .post(
    adminOnly,
    validate({ params: idParams, body: createPatientForDoctorSchema }),
    controller.addPatient,
  );

doctorRouter.delete(
  '/:id/patients/:patientId',
  adminOnly,
  validate({ params: doctorPatientParams }),
  controller.removePatient,
);
