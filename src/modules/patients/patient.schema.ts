import { z } from 'zod';
import { BLOOD_GROUPS, GENDERS, PATIENT_CONDITIONS } from '../../constants/domain.js';
import {
  atLeastOneField,
  csvEnum,
  dateRangeQuery,
  email,
  objectId,
  optionalQuery,
  pageQuery,
  personName,
  phone,
  refineDateRange,
} from '../../utils/zod.js';

export const PATIENT_SORTS = ['newest', 'oldest', 'name_asc', 'name_desc'] as const;
export type PatientSort = (typeof PATIENT_SORTS)[number];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const dateOfBirth = z.coerce
  .date('Enter a valid date of birth')
  .refine((date) => date <= new Date(), 'Date of birth cannot be in the future')
  .refine((date) => date >= new Date('1900-01-01'), 'Enter a realistic date of birth');

const admissionDate = z.coerce
  .date('Enter a valid admission date')
  .refine(
    (date) => date.getTime() <= Date.now() + ONE_DAY_MS,
    'Admission date cannot be in the future',
  );

const patientFields = {
  name: personName,
  email: email.nullable().optional(),
  phone,
  gender: z.enum(GENDERS, 'Choose a gender'),
  dateOfBirth,
  bloodGroup: z.enum(BLOOD_GROUPS, 'Choose a blood group').nullable().optional(),
  condition: z.enum(PATIENT_CONDITIONS, 'Choose a condition').optional(),
  diagnosis: z.string().trim().min(2, 'Must be at least 2 characters').max(200),
  admissionDate: admissionDate.optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
};

export const createPatientForDoctorSchema = z.object(patientFields).strict();

export const createPatientSchema = z.object({ ...patientFields, doctor: objectId }).strict();

export const updatePatientSchema = atLeastOneField(
  z
    .object({ ...patientFields, doctor: objectId })
    .partial()
    .strict(),
);

const patientListFilters = {
  ...pageQuery,
  ...dateRangeQuery,
  condition: csvEnum(PATIENT_CONDITIONS),
  gender: csvEnum(GENDERS),
  sort: optionalQuery(z.enum(PATIENT_SORTS)).transform((value) => value ?? 'newest'),
};

export const listPatientsQuery = z
  .object({ ...patientListFilters, doctor: optionalQuery(objectId) })
  .superRefine(refineDateRange);

export const listDoctorPatientsQuery = z.object(patientListFilters).superRefine(refineDateRange);

export const doctorPatientParams = z.object({ id: objectId, patientId: objectId });

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type CreatePatientForDoctorInput = z.infer<typeof createPatientForDoctorSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsQuery>;
export type ListDoctorPatientsQuery = z.infer<typeof listDoctorPatientsQuery>;
