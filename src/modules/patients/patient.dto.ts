import { differenceInYears } from 'date-fns';
import type { Types } from 'mongoose';
import type { IDoctor } from '../doctors/doctor.model.js';
import type { PatientLean } from './patient.model.js';

type DoctorRef = Pick<IDoctor, 'name' | 'specialization'> & { _id: Types.ObjectId };

export type PopulatedPatient = Omit<PatientLean, 'doctor'> & { doctor: DoctorRef | null };

export type PatientDTO = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  gender: PatientLean['gender'];
  dateOfBirth: string;
  age: number;
  bloodGroup: PatientLean['bloodGroup'] | null;
  condition: PatientLean['condition'];
  diagnosis: string;
  admissionDate: string;
  notes: string | null;
  doctor: { id: string; name: string; specialization: string } | null;
  createdAt: string;
  updatedAt: string;
};

export const DOCTOR_REF_FIELDS = 'name specialization';

export function toPatientDTO(patient: PopulatedPatient): PatientDTO {
  return {
    id: patient._id.toString(),
    name: patient.name,
    email: patient.email ?? null,
    phone: patient.phone,
    gender: patient.gender,
    dateOfBirth: patient.dateOfBirth.toISOString(),
    age: differenceInYears(new Date(), patient.dateOfBirth),
    bloodGroup: patient.bloodGroup ?? null,
    condition: patient.condition,
    diagnosis: patient.diagnosis,
    admissionDate: patient.admissionDate.toISOString(),
    notes: patient.notes ?? null,
    doctor: patient.doctor
      ? {
          id: patient.doctor._id.toString(),
          name: patient.doctor.name,
          specialization: patient.doctor.specialization,
        }
      : null,
    createdAt: patient.createdAt.toISOString(),
    updatedAt: patient.updatedAt.toISOString(),
  };
}
