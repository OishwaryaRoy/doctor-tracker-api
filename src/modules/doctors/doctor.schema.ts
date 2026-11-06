import { z } from 'zod';
import { SPECIALIZATIONS } from '../../constants/domain.js';
import {
  atLeastOneField,
  csvEnum,
  dateRangeQuery,
  email,
  optionalQuery,
  pageQuery,
  personName,
  phone,
  refineDateRange,
} from '../../utils/zod.js';

export const DOCTOR_SORTS = ['newest', 'oldest', 'name_asc', 'name_desc'] as const;
export type DoctorSort = (typeof DOCTOR_SORTS)[number];

export const doctorBodySchema = z.object({
  name: personName,
  specialization: z.enum(SPECIALIZATIONS, 'Choose a specialization from the list'),
  hospital: z.string().trim().min(2, 'Must be at least 2 characters').max(150),
  phone,
  email,
});

export const createDoctorSchema = doctorBodySchema.strict();
export const updateDoctorSchema = atLeastOneField(doctorBodySchema.partial().strict());

export const listDoctorsQuery = z
  .object({
    ...pageQuery,
    ...dateRangeQuery,
    specialization: csvEnum(SPECIALIZATIONS),
    hospital: optionalQuery(z.string().trim().max(150)),
    sort: optionalQuery(z.enum(DOCTOR_SORTS)).transform((value) => value ?? 'newest'),
  })
  .superRefine(refineDateRange);

export const doctorLookupQuery = z.object({
  search: optionalQuery(z.string().trim().max(100)),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
export type ListDoctorsQuery = z.infer<typeof listDoctorsQuery>;
export type DoctorLookupQuery = z.infer<typeof doctorLookupQuery>;
