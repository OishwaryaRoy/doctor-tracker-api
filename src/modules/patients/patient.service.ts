import type { SortOrder } from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { buildPageMeta, skipFor } from '../../utils/pagination.js';
import { buildSearchFilter } from '../../utils/search.js';
import { dateRangeFilter } from '../../utils/zod.js';
import { assertDoctorExists } from '../doctors/doctor.service.js';
import { DOCTOR_REF_FIELDS, toPatientDTO, type PopulatedPatient } from './patient.dto.js';
import { Patient } from './patient.model.js';
import type {
  CreatePatientInput,
  ListPatientsQuery,
  PatientSort,
  UpdatePatientInput,
} from './patient.schema.js';

const SORTS: Record<PatientSort, Record<string, SortOrder>> = {
  newest: { admissionDate: -1, _id: -1 },
  oldest: { admissionDate: 1, _id: 1 },
  name_asc: { name: 1, _id: 1 },
  name_desc: { name: -1, _id: -1 },
};

export async function listPatients(query: ListPatientsQuery) {
  const { page, limit, search, condition, gender, doctor, from, to, sort } = query;
  const admissionDate = dateRangeFilter(from, to);

  const filter = {
    ...buildSearchFilter(search),
    ...(doctor && { doctor }),
    ...(condition && { condition: { $in: condition } }),
    ...(gender && { gender: { $in: gender } }),
    ...(admissionDate && { admissionDate }),
  };
  const hasFilter = Object.keys(filter).length > 0;

  const [patients, total] = await Promise.all([
    Patient.find(filter)
      .sort(SORTS[sort])
      .skip(skipFor(page, limit))
      .limit(limit)
      .populate('doctor', DOCTOR_REF_FIELDS)
      .lean<PopulatedPatient[]>(),
    hasFilter ? Patient.countDocuments(filter) : Patient.estimatedDocumentCount(),
  ]);

  return { data: patients.map(toPatientDTO), meta: buildPageMeta(total, page, limit) };
}

export async function getPatient(id: string) {
  const patient = await Patient.findById(id)
    .populate('doctor', DOCTOR_REF_FIELDS)
    .lean<PopulatedPatient>();
  if (!patient) throw ApiError.notFound('Patient');
  return toPatientDTO(patient);
}

export async function createPatient(input: CreatePatientInput) {
  await assertDoctorExists(input.doctor);
  const values = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== null));
  const patient = await Patient.create(values);
  await patient.populate('doctor', DOCTOR_REF_FIELDS);
  return toPatientDTO(patient.toObject() as unknown as PopulatedPatient);
}

export async function updatePatient(id: string, input: UpdatePatientInput) {
  const patient = await Patient.findById(id);
  if (!patient) throw ApiError.notFound('Patient');

  if (input.doctor && input.doctor !== patient.doctor.toString()) {
    await assertDoctorExists(input.doctor);
  }

  for (const [key, value] of Object.entries(input)) {
    patient.set(key, value === null ? undefined : value);
  }
  await patient.save();

  await patient.populate('doctor', DOCTOR_REF_FIELDS);
  return toPatientDTO(patient.toObject() as unknown as PopulatedPatient);
}

export async function deletePatient(id: string, doctorId?: string) {
  const deleted = await Patient.findOneAndDelete({ _id: id, ...(doctorId && { doctor: doctorId }) })
    .select({ _id: 1 })
    .lean();
  if (!deleted) throw ApiError.notFound('Patient');
}
