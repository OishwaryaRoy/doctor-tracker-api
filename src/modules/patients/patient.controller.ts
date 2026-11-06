import type { RequestHandler } from 'express';
import { input } from '../../middleware/validate.js';
import type {
  CreatePatientInput,
  ListPatientsQuery,
  UpdatePatientInput,
} from './patient.schema.js';
import * as patientService from './patient.service.js';

type IdParams = { id: string };

export const list: RequestHandler = async (req, res) => {
  res.json(await patientService.listPatients(input.query<ListPatientsQuery>(req)));
};

export const get: RequestHandler = async (req, res) => {
  res.json({ data: await patientService.getPatient(input.params<IdParams>(req).id) });
};

export const create: RequestHandler = async (req, res) => {
  const patient = await patientService.createPatient(input.body<CreatePatientInput>(req));
  res.status(201).location(`${req.baseUrl}/${patient.id}`).json({ data: patient });
};

export const update: RequestHandler = async (req, res) => {
  const { id } = input.params<IdParams>(req);
  res.json({ data: await patientService.updatePatient(id, input.body<UpdatePatientInput>(req)) });
};

export const remove: RequestHandler = async (req, res) => {
  await patientService.deletePatient(input.params<IdParams>(req).id);
  res.status(204).end();
};
