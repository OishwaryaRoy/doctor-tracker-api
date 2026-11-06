import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, inject } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = inject('mongoUri');
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const models = await Promise.all([
  import('../src/modules/users/user.model.js').then((m) => m.User),
  import('../src/modules/doctors/doctor.model.js').then((m) => m.Doctor),
  import('../src/modules/patients/patient.model.js').then((m) => m.Patient),
]);

beforeAll(async () => {
  await connectDB();
  await Promise.all(models.map((model) => model.syncIndexes()));
});

afterEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await disconnectDB();
});
