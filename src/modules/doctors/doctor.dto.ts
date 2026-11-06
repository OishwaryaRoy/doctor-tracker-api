import type { PatientCondition } from '../../constants/domain.js';
import type { DoctorLean } from './doctor.model.js';

export type DoctorDTO = {
  id: string;
  name: string;
  specialization: DoctorLean['specialization'];
  hospital: string;
  phone: string;
  email: string;
  patientCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DoctorDetailDTO = DoctorDTO & {
  patientsByCondition: Record<PatientCondition, number>;
};

export function toDoctorDTO(doctor: DoctorLean, patientCount = 0): DoctorDTO {
  return {
    id: doctor._id.toString(),
    name: doctor.name,
    specialization: doctor.specialization,
    hospital: doctor.hospital,
    phone: doctor.phone,
    email: doctor.email,
    patientCount,
    createdAt: doctor.createdAt.toISOString(),
    updatedAt: doctor.updatedAt.toISOString(),
  };
}
