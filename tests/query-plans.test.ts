import { describe, expect, it } from 'vitest';
import { Doctor } from '../src/modules/doctors/doctor.model.js';
import { Patient } from '../src/modules/patients/patient.model.js';
import { buildSearchFilter } from '../src/utils/search.js';
import { createDoctor, createPatient } from './helpers.js';

function stagesOf(plan: unknown): string[] {
  const stages: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (typeof record.stage === 'string') stages.push(record.stage);
    Object.values(record).forEach(walk);
  };
  walk(plan);
  return stages;
}

async function winningStages(query: { explain: (v: string) => Promise<unknown> }) {
  const explained = (await query.explain('queryPlanner')) as {
    queryPlanner: { winningPlan: unknown };
  };
  return stagesOf(explained.queryPlanner.winningPlan);
}

describe('query plans', () => {
  it.each([
    ['default patient list', () => Patient.find({}).sort({ admissionDate: -1, _id: -1 }).limit(10)],
    [
      'patients by condition + date range',
      () =>
        Patient.find({
          condition: { $in: ['critical'] },
          admissionDate: { $gte: new Date('2026-01-01') },
        })
          .sort({ admissionDate: -1, _id: -1 })
          .limit(10),
    ],
    [
      'a doctor’s patients',
      () =>
        Patient.find({ doctor: '64b7f0c2a1b2c3d4e5f60718' }).sort({ admissionDate: -1, _id: -1 }),
    ],
    ['patient search', () => Patient.find(buildSearchFilter('john sm')).limit(10)],
    ['doctor search', () => Doctor.find(buildSearchFilter('cardio')).limit(10)],
    [
      'doctors by specialization',
      () =>
        Doctor.find({ specialization: { $in: ['Cardiology'] } }).sort({ createdAt: -1, _id: -1 }),
    ],
  ])('%s uses an index', async (_name, build) => {
    const doctor = await createDoctor();
    await createPatient(doctor._id);

    const stages = await winningStages(build());

    expect(stages).toContain('IXSCAN');
    expect(stages).not.toContain('COLLSCAN');
  });
});
