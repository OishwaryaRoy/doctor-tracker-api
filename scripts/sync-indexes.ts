import { pathToFileURL } from 'node:url';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Doctor } from '../src/modules/doctors/doctor.model.js';
import { Patient } from '../src/modules/patients/patient.model.js';
import { User } from '../src/modules/users/user.model.js';

export async function syncAllIndexes() {
  for (const model of [User, Doctor, Patient]) {
    await model.syncIndexes();
    console.log(`  indexes synced: ${model.collection.name}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await connectDB();
  try {
    await syncAllIndexes();
  } finally {
    await disconnectDB();
  }
}
