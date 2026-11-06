import { describe, expect, it } from 'vitest';
import {
  adminCookie,
  api,
  createDoctor,
  createPatient,
  patientPayload,
  viewerCookie,
} from './helpers.js';

const list = (query: Record<string, string> = {}) =>
  api().get('/api/v1/patients').query(query).set('Cookie', viewerCookie());

describe('GET /api/v1/patients', () => {
  it('lists patients newest first with their doctor attached', async () => {
    const doctor = await createDoctor({ name: 'Grace Hopper' });
    await createPatient(doctor._id, { admissionDate: new Date('2026-01-01') });
    const newest = await createPatient(doctor._id, { admissionDate: new Date('2026-03-01') });

    const res = await list();

    expect(res.status).toBe(200);
    expect(res.body.data[0].id).toBe(newest._id.toString());
    expect(res.body.data[0].doctor).toMatchObject({ name: 'Grace Hopper' });
    expect(res.body.data[0].age).toBeGreaterThan(30);
  });

  it('filters by condition (multi-value), gender, doctor and admission date', async () => {
    const a = await createDoctor();
    const b = await createDoctor();
    await createPatient(a._id, {
      condition: 'critical',
      gender: 'female',
      admissionDate: new Date('2026-01-10'),
    });
    await createPatient(a._id, {
      condition: 'stable',
      gender: 'male',
      admissionDate: new Date('2026-02-10'),
    });
    await createPatient(b._id, {
      condition: 'recovering',
      gender: 'female',
      admissionDate: new Date('2026-03-10'),
    });

    expect((await list({ condition: 'critical,recovering' })).body.meta.total).toBe(2);
    expect((await list({ gender: 'female' })).body.meta.total).toBe(2);
    expect((await list({ doctor: b._id.toString() })).body.meta.total).toBe(1);
    expect((await list({ from: '2026-02-01', to: '2026-02-28' })).body.meta.total).toBe(1);
    expect((await list({ to: '2026-01-10' })).body.meta.total).toBe(1);
  });

  it('searches by name, email and phone digits', async () => {
    const doctor = await createDoctor();
    await createPatient(doctor._id, {
      name: 'Maria Garcia',
      email: 'maria.g@mail.dev',
      phone: '+1 (415) 555-0199',
    });
    await createPatient(doctor._id, { name: 'Tom Lee' });

    expect((await list({ search: 'gar' })).body.data.map((p: { name: string }) => p.name)).toEqual([
      'Maria Garcia',
    ]);
    expect((await list({ search: 'maria.g@' })).body.meta.total).toBe(1);
    expect((await list({ search: '1415555' })).body.meta.total).toBe(1);
  });

  it('rejects unknown filter values', async () => {
    const res = await list({ condition: 'zombie' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/patients', () => {
  it('creates a patient for the chosen doctor', async () => {
    const doctor = await createDoctor();

    const res = await api()
      .post('/api/v1/patients')
      .set('Cookie', adminCookie())
      .send(patientPayload({ doctor: doctor._id.toString(), bloodGroup: null }));

    expect(res.status).toBe(201);
    expect(res.body.data.bloodGroup).toBeNull();
  });

  it('rejects a future date of birth', async () => {
    const doctor = await createDoctor();
    const res = await api()
      .post('/api/v1/patients')
      .set('Cookie', adminCookie())
      .send(patientPayload({ doctor: doctor._id.toString(), dateOfBirth: '2999-01-01' }));

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('body.dateOfBirth');
  });
});

describe('PATCH /api/v1/patients/:id', () => {
  it('edits fields, clears optional ones with null and reassigns the doctor', async () => {
    const first = await createDoctor();
    const second = await createDoctor({ name: 'New Doctor' });
    const patient = await createPatient(first._id);

    const res = await api()
      .patch(`/api/v1/patients/${patient._id}`)
      .set('Cookie', adminCookie())
      .send({ condition: 'discharged', email: null, doctor: second._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ condition: 'discharged', email: null });
    expect(res.body.data.doctor.name).toBe('New Doctor');
  });

  it('returns 404 when reassigning to an unknown doctor', async () => {
    const patient = await createPatient((await createDoctor())._id);
    const res = await api()
      .patch(`/api/v1/patients/${patient._id}`)
      .set('Cookie', adminCookie())
      .send({ doctor: '64b7f0c2a1b2c3d4e5f60718' });
    expect(res.status).toBe(404);
  });

  it('forbids viewers from editing', async () => {
    const patient = await createPatient((await createDoctor())._id);
    const res = await api()
      .patch(`/api/v1/patients/${patient._id}`)
      .set('Cookie', viewerCookie())
      .send({ condition: 'stable' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/patients/:id', () => {
  it('deletes a patient', async () => {
    const patient = await createPatient((await createDoctor())._id);

    const first = await api()
      .delete(`/api/v1/patients/${patient._id}`)
      .set('Cookie', adminCookie());
    const second = await api()
      .delete(`/api/v1/patients/${patient._id}`)
      .set('Cookie', adminCookie());

    expect(first.status).toBe(204);
    expect(second.status).toBe(404);
  });
});
