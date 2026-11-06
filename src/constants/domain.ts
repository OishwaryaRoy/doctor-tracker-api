export const ROLES = ['admin', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const SPECIALIZATIONS = [
  'Cardiology',
  'Dermatology',
  'Emergency Medicine',
  'Endocrinology',
  'Gastroenterology',
  'General Practice',
  'Neurology',
  'Obstetrics & Gynecology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
  'Pulmonology',
  'Radiology',
  'Urology',
] as const;
export type Specialization = (typeof SPECIALIZATIONS)[number];

export const PATIENT_CONDITIONS = [
  'stable',
  'critical',
  'recovering',
  'under_observation',
  'discharged',
] as const;
export type PatientCondition = (typeof PATIENT_CONDITIONS)[number];

export const GENDERS = ['male', 'female', 'other'] as const;
export type Gender = (typeof GENDERS)[number];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];
