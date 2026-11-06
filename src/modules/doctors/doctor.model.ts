import { Schema, model, type Types } from 'mongoose';
import { SPECIALIZATIONS, type Specialization } from '../../constants/domain.js';
import { buildSearchTokens, digitsOnly } from '../../utils/search.js';

export interface IDoctor {
  name: string;
  specialization: Specialization;
  hospital: string;
  phone: string;
  email: string;
  searchTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type DoctorLean = IDoctor & { _id: Types.ObjectId };

const doctorSchema = new Schema<IDoctor>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    specialization: { type: String, required: true, enum: SPECIALIZATIONS },
    hospital: { type: String, required: true, trim: true, maxlength: 150 },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    searchTokens: { type: [String], select: false },
  },
  { timestamps: true },
);

doctorSchema.pre('validate', function () {
  this.searchTokens = buildSearchTokens(
    [this.name, this.hospital],
    [this.email, digitsOnly(this.phone ?? '')],
  );
});

doctorSchema.index({ email: 1 }, { unique: true });
doctorSchema.index({ createdAt: -1, _id: -1 });
doctorSchema.index({ specialization: 1, createdAt: -1, _id: -1 });
doctorSchema.index({ hospital: 1, createdAt: -1 });
doctorSchema.index({ name: 1, _id: 1 });
doctorSchema.index({ searchTokens: 1 });

export const Doctor = model<IDoctor>('Doctor', doctorSchema);
