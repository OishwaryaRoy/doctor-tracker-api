import type { RequestHandler } from 'express';
import { input } from '../../middleware/validate.js';
import * as patientService from '../patients/patient.service.js';
import type {
  CreatePatientForDoctorInput,
  ListDoctorPatientsQuery,
} from '../patients/patient.schema.js';
import type {
  CreateDoctorInput,
  DoctorLookupQuery,
  ListDoctorsQuery,
  UpdateDoctorInput,
} from './doctor.schema.js';
import * as doctorService from './doctor.service.js';

type IdParams = { id: string };

export const list: RequestHandler = async (req, res) => {
  res.json(await doctorService.listDoctors(input.query<ListDoctorsQuery>(req)));
};

export const lookup: RequestHandler = async (req, res) => {
  res.json({ data: await doctorService.lookupDoctors(input.query<DoctorLookupQuery>(req)) });
};

export const get: RequestHandler = async (req, res) => {
  res.json({ data: await doctorService.getDoctor(input.params<IdParams>(req).id) });
};

export const create: RequestHandler = async (req, res) => {
  const doctor = await doctorService.createDoctor(input.body<CreateDoctorInput>(req));
  res.status(201).location(`${req.baseUrl}/${doctor.id}`).json({ data: doctor });
};

export const update: RequestHandler = async (req, res) => {
  const { id } = input.params<IdParams>(req);
  res.json({ data: await doctorService.updateDoctor(id, input.body<UpdateDoctorInput>(req)) });
};

export const remove: RequestHandler = async (req, res) => {
  await doctorService.deleteDoctor(input.params<IdParams>(req).id);
  res.status(204).end();
};

export const listPatients: RequestHandler = async (req, res) => {
  const { id } = input.params<IdParams>(req);
  await doctorService.assertDoctorExists(id);
  res.json(
    await patientService.listPatients({ ...input.query<ListDoctorPatientsQuery>(req), doctor: id }),
  );
};

export const addPatient: RequestHandler = async (req, res) => {
  const { id } = input.params<IdParams>(req);
  const patient = await patientService.createPatient({
    ...input.body<CreatePatientForDoctorInput>(req),
    doctor: id,
  });
  res.status(201).json({ data: patient });
};

export const removePatient: RequestHandler = async (req, res) => {
  const { id, patientId } = input.params<IdParams & { patientId: string }>(req);
  await patientService.deletePatient(patientId, id);
  res.status(204).end();
};
