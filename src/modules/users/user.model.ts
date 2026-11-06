import bcrypt from 'bcryptjs';
import { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { ROLES, type Role } from '../../constants/domain.js';

const BCRYPT_COST = 12;

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface UserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

type UserModel = Model<IUser, object, UserMethods> & {
  hashPassword(plain: string): Promise<string>;
};

const userSchema = new Schema<IUser, UserModel, UserMethods>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'viewer' },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

userSchema.methods.comparePassword = function (this: HydratedDocument<IUser>, candidate: string) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.statics.hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_COST);

export const User = model<IUser, UserModel>('User', userSchema);
