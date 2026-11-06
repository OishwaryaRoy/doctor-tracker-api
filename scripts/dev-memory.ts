import { MongoMemoryServer } from 'mongodb-memory-server';

const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri('doctor-tracker');
process.env.JWT_SECRET ??= 'local-dev-only-secret-change-me-0123456789';

const { connectDB } = await import('../src/config/db.js');
const { runSeed } = await import('./seed.js');

await connectDB();
await runSeed({ fresh: true, doctors: 40, patients: 3000 });
await import('../src/server.js');

process.on('exit', () => void mongo.stop());
