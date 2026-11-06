import supertest from 'supertest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import type { Role } from '../src/constants/domain.js';
import { signToken } from '../src/modules/auth/token.js';
import { Doctor, type IDoctor } from '../src/modules/doctors/doctor.model.js';
import { Patient, type IPatient } from '../src/modules/patients/patient.model.js';
import { User } from '../src/modules/users/user.model.js';
import { Types } from 'mongoose';

export const api = () => supertest(app);

export function sessionCookie(role: Role = 'admin', id = new Types.ObjectId().toString()) {
  return `${env.COOKIE_NAME}=${signToken({ sub: id, role })}`;
}

export const adminCookie = () => sessionCookie('admin');
export const viewerCookie = () => sessionCookie('viewer');

export async function createUser(role: Role = 'admin', password = 'Password@123') {
  const email = `${role}-${new Types.ObjectId().toString()}@test.dev`;
  const user = await User.create({
    name: `${role} user`,
    email,
    role,
    passwordHash: await User.hashPassword(password),
  });
  return { user, email, password };
}

let counter = 0;

export function doctorPayload(overrides: Partial<IDoctor> = {}) {
  counter += 1;
  return {
    name: `Alice Walker ${counter}`,
    specialization: 'Cardiology' as const,
    hospital: 'Riverside General Hospital',
    phone: '+1 555 010 0000',
    email: `doctor${counter}@test.dev`,
    ...overrides,
  };
}

export async function createDoctor(overrides: Partial<IDoctor> = {}) {
  return Doctor.create(doctorPayload(overrides));
}

export function patientPayload(overrides: Record<string, unknown> = {}) {
  counter += 1;
  return {
    name: `John Smith ${counter}`,
    email: `patient${counter}@test.dev`,
    phone: '+1 555 020 1234',
    gender: 'male',
    dateOfBirth: '1985-04-12',
    condition: 'stable',
    diagnosis: 'Hypertension',
    admissionDate: '2026-01-15T10:00:00.000Z',
    ...overrides,
  };
}

export async function createPatient(doctor: Types.ObjectId, overrides: Partial<IPatient> = {}) {
  const values: Record<string, unknown> = { ...patientPayload(), doctor, ...overrides };
  return new Patient(values).save();
}
