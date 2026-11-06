import { Schema, model, type Types } from 'mongoose';
import {
  BLOOD_GROUPS,
  GENDERS,
  PATIENT_CONDITIONS,
  type BloodGroup,
  type Gender,
  type PatientCondition,
} from '../../constants/domain.js';
import { buildSearchTokens, digitsOnly } from '../../utils/search.js';

export interface IPatient {
  name: string;
  email?: string;
  phone: string;
  gender: Gender;
  dateOfBirth: Date;
  bloodGroup?: BloodGroup;
  condition: PatientCondition;
  diagnosis: string;
  admissionDate: Date;
  notes?: string;
  doctor: Types.ObjectId;
  searchTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type PatientLean = IPatient & { _id: Types.ObjectId };

const patientSchema = new Schema<IPatient>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    gender: { type: String, required: true, enum: GENDERS },
    dateOfBirth: { type: Date, required: true },
    bloodGroup: { type: String, enum: BLOOD_GROUPS },
    condition: {
      type: String,
      required: true,
      enum: PATIENT_CONDITIONS,
      default: 'under_observation',
    },
    diagnosis: { type: String, required: true, trim: true, maxlength: 200 },
    admissionDate: { type: Date, required: true, default: () => new Date() },
    notes: { type: String, trim: true, maxlength: 2000 },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    searchTokens: { type: [String], select: false },
  },
  { timestamps: true },
);

patientSchema.pre('validate', function () {
  this.searchTokens = buildSearchTokens(
    [this.name, this.diagnosis],
    [this.email ?? '', digitsOnly(this.phone ?? '')],
  );
});

patientSchema.index({ admissionDate: -1, _id: -1 });
patientSchema.index({ doctor: 1, admissionDate: -1, _id: -1 });
patientSchema.index({ condition: 1, admissionDate: -1, _id: -1 });
patientSchema.index({ name: 1, _id: 1 });
patientSchema.index({ searchTokens: 1 });

export const Patient = model<IPatient>('Patient', patientSchema);
