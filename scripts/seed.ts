import { faker } from '@faker-js/faker';
import { subDays } from 'date-fns';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { Types } from 'mongoose';
import {
  BLOOD_GROUPS,
  GENDERS,
  SPECIALIZATIONS,
  type PatientCondition,
  type Specialization,
} from '../src/constants/domain.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Doctor } from '../src/modules/doctors/doctor.model.js';
import { Patient } from '../src/modules/patients/patient.model.js';
import { User } from '../src/modules/users/user.model.js';
import { syncAllIndexes } from './sync-indexes.js';

const HOSPITALS = [
  'Riverside General Hospital',
  'Northgate Medical Center',
  'St. Aurelia Hospital',
  'Lakeview Community Hospital',
  'Summit Heart & Vascular Institute',
  "Greenfield Children's Hospital",
  'Harborpoint University Hospital',
  'Meadowbrook Clinic',
];

const DIAGNOSES: Record<Specialization, string[]> = {
  Cardiology: ['Hypertension', 'Atrial fibrillation', 'Coronary artery disease', 'Heart failure'],
  Dermatology: ['Psoriasis', 'Atopic dermatitis', 'Cellulitis', 'Acne vulgaris'],
  'Emergency Medicine': ['Fractured wrist', 'Acute abdominal pain', 'Concussion', 'Laceration'],
  Endocrinology: ['Type 2 diabetes', 'Hypothyroidism', "Graves' disease", 'Osteoporosis'],
  Gastroenterology: ['GERD', "Crohn's disease", 'Irritable bowel syndrome', 'Gallstones'],
  'General Practice': ['Seasonal influenza', 'Upper respiratory infection', 'Back pain', 'Anemia'],
  Neurology: ['Migraine', 'Epilepsy', "Parkinson's disease", 'Peripheral neuropathy'],
  'Obstetrics & Gynecology': ['Prenatal care', 'Endometriosis', 'PCOS', 'Gestational diabetes'],
  Oncology: ['Breast cancer', 'Lung cancer', 'Lymphoma', 'Colorectal cancer'],
  Ophthalmology: ['Cataract', 'Glaucoma', 'Diabetic retinopathy', 'Macular degeneration'],
  Orthopedics: ['ACL tear', 'Osteoarthritis', 'Hip fracture', 'Rotator cuff injury'],
  Pediatrics: ['Bronchiolitis', 'Otitis media', 'Asthma', 'Gastroenteritis'],
  Psychiatry: [
    'Generalized anxiety disorder',
    'Major depressive disorder',
    'Bipolar disorder',
    'PTSD',
  ],
  Pulmonology: ['COPD', 'Pneumonia', 'Asthma exacerbation', 'Sleep apnea'],
  Radiology: [
    'Follow-up imaging',
    'Suspected pulmonary nodule',
    'Kidney stone imaging',
    'MRI review',
  ],
  Urology: [
    'Kidney stones',
    'Benign prostatic hyperplasia',
    'Urinary tract infection',
    'Bladder dysfunction',
  ],
};

const CONDITION_WEIGHTS: { value: PatientCondition; weight: number }[] = [
  { value: 'stable', weight: 35 },
  { value: 'recovering', weight: 25 },
  { value: 'under_observation', weight: 20 },
  { value: 'discharged', weight: 12 },
  { value: 'critical', weight: 8 },
];

const HISTORY_DAYS = 730;
const BATCH_SIZE = 1000;

const fakePhone = () =>
  `+1 ${faker.string.numeric({ length: 1, exclude: ['0', '1'] })}${faker.string.numeric(2)} ` +
  `${faker.string.numeric(3)} ${faker.string.numeric(4)}`;

export type SeedOptions = { fresh: boolean; doctors: number; patients: number };

export async function seedUsers() {
  const users = [
    {
      name: process.env.SEED_ADMIN_NAME ?? 'Admin User',
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@doctortracker.test',
      password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345',
      role: 'admin' as const,
    },
    {
      name: process.env.SEED_VIEWER_NAME ?? 'Viewer User',
      email: process.env.SEED_VIEWER_EMAIL ?? 'viewer@doctortracker.test',
      password: process.env.SEED_VIEWER_PASSWORD ?? 'Viewer@12345',
      role: 'viewer' as const,
    },
  ];

  for (const { password, ...user } of users) {
    const passwordHash = await User.hashPassword(password);
    await User.updateOne(
      { email: user.email.toLowerCase() },
      { $set: { ...user, email: user.email.toLowerCase(), passwordHash } },
      { upsert: true },
    );
    console.log(`  user  ${user.email} (${user.role})`);
  }
}

async function prepare<T extends { validate(): Promise<void>; toObject(): object }>(doc: T) {
  await doc.validate();
  return doc.toObject();
}

async function seedDoctors(count: number) {
  const now = new Date();
  const docs = [];
  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const createdAt = faker.datatype.boolean(0.8)
      ? faker.date.between({
          from: subDays(now, HISTORY_DAYS + 365),
          to: subDays(now, HISTORY_DAYS),
        })
      : faker.date.between({ from: subDays(now, HISTORY_DAYS), to: subDays(now, 30) });
    const doctor = await prepare(
      new Doctor({
        name: `${firstName} ${lastName}`,
        specialization:
          i < SPECIALIZATIONS.length
            ? SPECIALIZATIONS[i]
            : faker.helpers.arrayElement(SPECIALIZATIONS),
        hospital: faker.helpers.arrayElement(HOSPITALS),
        phone: fakePhone(),
        email: faker.internet
          .email({ firstName, lastName, provider: 'doctortracker.test' })
          .toLowerCase()
          .replace('@', `.${i}@`),
      }),
    );
    docs.push({ ...doctor, createdAt, updatedAt: createdAt });
  }
  await Doctor.collection.insertMany(docs);
  return docs as unknown as {
    _id: Types.ObjectId;
    specialization: Specialization;
    createdAt: Date;
  }[];
}

async function seedPatients(count: number, doctors: Awaited<ReturnType<typeof seedDoctors>>) {
  const now = new Date();
  const doctorWeights = doctors.map((doctor) => ({
    value: doctor,
    weight: faker.number.int({ min: 1, max: 10 }),
  }));

  for (let start = 0; start < count; start += BATCH_SIZE) {
    const batch = [];
    for (let i = start; i < Math.min(start + BATCH_SIZE, count); i++) {
      const doctor = faker.helpers.weightedArrayElement(doctorWeights);
      const gender = faker.helpers.arrayElement(GENDERS);
      const sex = gender === 'other' ? undefined : gender;
      const firstName = faker.person.firstName(sex);
      const lastName = faker.person.lastName();
      const daysAgo = Math.floor(HISTORY_DAYS * (1 - Math.pow(faker.number.float(), 0.8)));
      const earliest = subDays(now, daysAgo + 1);
      const admittedAt = faker.date.between({
        from: earliest < doctor.createdAt ? doctor.createdAt : earliest,
        to: earliest < doctor.createdAt ? now : subDays(now, daysAgo),
      });
      const age =
        doctor.specialization === 'Pediatrics'
          ? faker.number.int({ min: 0, max: 17 })
          : faker.number.int({ min: 18, max: 92 });

      const patient = await prepare(
        new Patient({
          name: `${firstName} ${lastName}`,
          email: faker.datatype.boolean(0.8)
            ? faker.internet.email({ firstName, lastName }).toLowerCase()
            : undefined,
          phone: fakePhone(),
          gender,
          dateOfBirth: faker.date.birthdate({ mode: 'age', min: age, max: age }),
          bloodGroup: faker.helpers.arrayElement(BLOOD_GROUPS),
          condition: faker.helpers.weightedArrayElement(CONDITION_WEIGHTS),
          diagnosis: faker.helpers.arrayElement(DIAGNOSES[doctor.specialization]),
          admissionDate: admittedAt,
          notes: faker.datatype.boolean(0.4) ? faker.lorem.sentence() : undefined,
          doctor: doctor._id,
        }),
      );
      batch.push({ ...patient, createdAt: admittedAt, updatedAt: admittedAt });
    }
    await Patient.collection.insertMany(batch, { ordered: false });
    console.log(`  patients ${Math.min(start + BATCH_SIZE, count)}/${count}`);
  }
}

export async function runSeed({ fresh, doctors, patients }: SeedOptions) {
  faker.seed(20261105);

  await syncAllIndexes();
  console.log('Users');
  await seedUsers();

  if (fresh) {
    await Promise.all([Patient.deleteMany({}), Doctor.deleteMany({})]);
    console.log('Removed existing doctors and patients');
  } else if (await Doctor.exists({})) {
    console.log('Doctors already exist - skipping data (use --fresh to regenerate)');
    return;
  }

  console.log(`Doctors (${doctors})`);
  const createdDoctors = await seedDoctors(doctors);
  console.log(`Patients (${patients})`);
  await seedPatients(patients, createdDoctors);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { values } = parseArgs({
    options: {
      fresh: { type: 'boolean', default: false },
      doctors: { type: 'string', default: '40' },
      patients: { type: 'string', default: '3000' },
    },
  });

  await connectDB();
  try {
    await runSeed({
      fresh: values.fresh,
      doctors: Number(values.doctors),
      patients: Number(values.patients),
    });
    console.log('Seed complete');
  } finally {
    await disconnectDB();
  }
}
