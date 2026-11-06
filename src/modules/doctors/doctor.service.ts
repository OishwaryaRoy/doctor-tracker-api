import { Types, type SortOrder } from 'mongoose';
import { PATIENT_CONDITIONS, type PatientCondition } from '../../constants/domain.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildPageMeta, skipFor } from '../../utils/pagination.js';
import { buildSearchFilter } from '../../utils/search.js';
import { dateRangeFilter } from '../../utils/zod.js';
import { Patient } from '../patients/patient.model.js';
import { toDoctorDTO, type DoctorDetailDTO } from './doctor.dto.js';
import { Doctor, type DoctorLean } from './doctor.model.js';
import type {
  CreateDoctorInput,
  DoctorLookupQuery,
  DoctorSort,
  ListDoctorsQuery,
  UpdateDoctorInput,
} from './doctor.schema.js';

const SORTS: Record<DoctorSort, Record<string, SortOrder>> = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  name_asc: { name: 1, _id: 1 },
  name_desc: { name: -1, _id: -1 },
};

async function patientCountsFor(doctorIds: Types.ObjectId[]): Promise<Map<string, number>> {
  if (doctorIds.length === 0) return new Map();
  const rows = await Patient.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { doctor: { $in: doctorIds } } },
    { $group: { _id: '$doctor', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id.toString(), row.count]));
}

export async function listDoctors(query: ListDoctorsQuery) {
  const { page, limit, search, specialization, hospital, from, to, sort } = query;
  const createdAt = dateRangeFilter(from, to);

  const filter = {
    ...buildSearchFilter(search),
    ...(specialization && { specialization: { $in: specialization } }),
    ...(hospital && { hospital }),
    ...(createdAt && { createdAt }),
  };
  const hasFilter = Object.keys(filter).length > 0;

  const [doctors, total] = await Promise.all([
    Doctor.find(filter)
      .sort(SORTS[sort])
      .skip(skipFor(page, limit))
      .limit(limit)
      .lean<DoctorLean[]>(),
    hasFilter ? Doctor.countDocuments(filter) : Doctor.estimatedDocumentCount(),
  ]);

  const counts = await patientCountsFor(doctors.map((doctor) => doctor._id));

  return {
    data: doctors.map((doctor) => toDoctorDTO(doctor, counts.get(doctor._id.toString()) ?? 0)),
    meta: buildPageMeta(total, page, limit),
  };
}

export async function lookupDoctors({ search, limit }: DoctorLookupQuery) {
  const doctors = await Doctor.find(buildSearchFilter(search))
    .select({ name: 1, specialization: 1 })
    .sort({ name: 1, _id: 1 })
    .limit(limit)
    .lean();
  return doctors.map((doctor) => ({
    id: doctor._id.toString(),
    name: doctor.name,
    specialization: doctor.specialization,
  }));
}

export async function getDoctor(id: string): Promise<DoctorDetailDTO> {
  const doctorId = new Types.ObjectId(id);
  const [doctor, byCondition] = await Promise.all([
    Doctor.findById(doctorId).lean<DoctorLean>(),
    Patient.aggregate<{ _id: PatientCondition; count: number }>([
      { $match: { doctor: doctorId } },
      { $group: { _id: '$condition', count: { $sum: 1 } } },
    ]),
  ]);
  if (!doctor) throw ApiError.notFound('Doctor');

  const patientsByCondition = Object.fromEntries(PATIENT_CONDITIONS.map((c) => [c, 0])) as Record<
    PatientCondition,
    number
  >;
  let total = 0;
  for (const row of byCondition) {
    patientsByCondition[row._id] = row.count;
    total += row.count;
  }

  return { ...toDoctorDTO(doctor, total), patientsByCondition };
}

export async function createDoctor(input: CreateDoctorInput) {
  const doctor = await Doctor.create(input);
  return toDoctorDTO(doctor.toObject(), 0);
}

export async function updateDoctor(id: string, input: UpdateDoctorInput) {
  const doctor = await Doctor.findById(id);
  if (!doctor) throw ApiError.notFound('Doctor');

  doctor.set(input);
  await doctor.save();

  const patientCount = await Patient.countDocuments({ doctor: doctor._id });
  return toDoctorDTO(doctor.toObject(), patientCount);
}

export async function deleteDoctor(id: string) {
  const doctor = await Doctor.exists({ _id: id });
  if (!doctor) throw ApiError.notFound('Doctor');

  if (await Patient.exists({ doctor: id })) {
    throw ApiError.conflict(
      'This doctor still has patients. Reassign or remove their patients before deleting the doctor.',
    );
  }
  await Doctor.deleteOne({ _id: id });
}

export async function assertDoctorExists(id: string | Types.ObjectId) {
  if (!(await Doctor.exists({ _id: id }))) throw ApiError.notFound('Doctor');
}

export async function listHospitals(): Promise<string[]> {
  const hospitals = await Doctor.distinct('hospital');
  return hospitals.sort((a, b) => a.localeCompare(b));
}
