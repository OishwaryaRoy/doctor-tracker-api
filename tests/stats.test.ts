import { describe, expect, it } from 'vitest';
import { api, createDoctor, createPatient, viewerCookie } from './helpers.js';

const overview = (query: Record<string, string>) =>
  api().get('/api/v1/stats/overview').query(query).set('Cookie', viewerCookie());

describe('GET /api/v1/stats/overview', () => {
  it('aggregates totals, a zero-filled timeline and breakdowns for the range', async () => {
    const busy = await createDoctor({ name: 'Busy Doctor', specialization: 'Neurology' });
    const quiet = await createDoctor({ name: 'Quiet Doctor' });
    await createPatient(busy._id, { admissionDate: new Date('2026-01-05'), condition: 'critical' });
    await createPatient(busy._id, { admissionDate: new Date('2026-01-20') });
    await createPatient(busy._id, { admissionDate: new Date('2026-03-02'), gender: 'female' });
    await createPatient(quiet._id, { admissionDate: new Date('2026-03-15') });
    await createPatient(quiet._id, { admissionDate: new Date('2025-11-15') });

    const res = await overview({ from: '2026-01-01', to: '2026-03-31', interval: 'month' });
    const data = res.body.data;

    expect(res.status).toBe(200);
    expect(data.totals).toEqual({
      doctors: 2,
      patients: 5,
      criticalPatients: 1,
      avgPatientsPerDoctor: 2.5,
    });
    expect(data.period).toEqual({ newPatients: 4, previousNewPatients: 1, changePct: 300 });
    expect(data.timeline).toEqual([
      { date: '2026-01-01T00:00:00.000Z', count: 2, critical: 1 },
      { date: '2026-02-01T00:00:00.000Z', count: 0, critical: 0 },
      { date: '2026-03-01T00:00:00.000Z', count: 2, critical: 0 },
    ]);
    expect(data.topDoctors.map((d: { name: string; count: number }) => [d.name, d.count])).toEqual([
      ['Busy Doctor', 3],
      ['Quiet Doctor', 1],
    ]);
    expect(data.byCondition).toHaveLength(5);
    expect(data.byGender).toEqual(
      expect.arrayContaining([
        { gender: 'female', count: 1 },
        { gender: 'male', count: 3 },
      ]),
    );
    expect(data.ageGroups.reduce((sum: number, g: { count: number }) => sum + g.count, 0)).toBe(4);
    expect(data.doctorsBySpecialization).toEqual(
      expect.arrayContaining([{ specialization: 'Neurology', count: 1 }]),
    );
  });

  it('buckets by the viewer’s time zone', async () => {
    const doctor = await createDoctor();
    await createPatient(doctor._id, { admissionDate: new Date('2026-01-31T23:30:00Z') });

    const utc = await overview({ from: '2026-01-01', to: '2026-02-28', interval: 'month' });
    const dhaka = await overview({
      from: '2026-01-01',
      to: '2026-02-28',
      interval: 'month',
      tz: 'Asia/Dhaka',
    });

    expect(utc.body.data.timeline[0].count).toBe(1);
    const feb = dhaka.body.data.timeline.find(
      (b: { date: string }) => b.date === '2026-01-31T18:00:00.000Z',
    );
    expect(feb.count).toBe(1);
  });

  it('picks a sensible interval when none is given', async () => {
    const res = await overview({ from: '2026-01-01', to: '2026-01-31' });
    expect(res.body.data.range.interval).toBe('day');
    expect(res.body.data.timeline).toHaveLength(31);
  });

  it('validates the time zone and bucket count', async () => {
    expect((await overview({ tz: 'Mars/Olympus' })).status).toBe(400);
    expect((await overview({ from: '2020-01-01', to: '2026-01-01', interval: 'day' })).status).toBe(
      400,
    );
  });
});
