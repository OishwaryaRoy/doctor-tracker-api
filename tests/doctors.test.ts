import { describe, expect, it } from 'vitest';
import { Patient } from '../src/modules/patients/patient.model.js';
import {
  adminCookie,
  api,
  createDoctor,
  createPatient,
  doctorPayload,
  patientPayload,
  viewerCookie,
} from './helpers.js';

describe('POST /api/v1/doctors', () => {
  it('lets an admin create a doctor', async () => {
    const payload = doctorPayload({ email: 'New.Doctor@Test.dev' });

    const res = await api().post('/api/v1/doctors').set('Cookie', adminCookie()).send(payload);

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/doctors/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({
      name: payload.name,
      email: 'new.doctor@test.dev',
      patientCount: 0,
    });
    expect(res.body.data).not.toHaveProperty('searchTokens');
  });

  it('forbids viewers from creating doctors', async () => {
    const res = await api()
      .post('/api/v1/doctors')
      .set('Cookie', viewerCookie())
      .send(doctorPayload());
    expect(res.status).toBe(403);
  });

  it('returns field-level validation errors', async () => {
    const res = await api()
      .post('/api/v1/doctors')
      .set('Cookie', adminCookie())
      .send({ name: 'A', specialization: 'Wizardry', phone: 'abc', email: 'nope' });

    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'body.name',
        'body.specialization',
        'body.hospital',
        'body.phone',
        'body.email',
      ]),
    );
  });

  it('rejects unknown fields', async () => {
    const res = await api()
      .post('/api/v1/doctors')
      .set('Cookie', adminCookie())
      .send({ ...doctorPayload(), role: 'admin' });
    expect(res.status).toBe(400);
  });

  it('returns 409 for a duplicate email', async () => {
    await createDoctor({ email: 'dup@test.dev' });

    const res = await api()
      .post('/api/v1/doctors')
      .set('Cookie', adminCookie())
      .send(doctorPayload({ email: 'dup@test.dev' }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

describe('GET /api/v1/doctors', () => {
  it('paginates with stable ordering and page metadata', async () => {
    for (let i = 0; i < 12; i++) await createDoctor();

    const page1 = await api().get('/api/v1/doctors?page=1&limit=5').set('Cookie', viewerCookie());
    const page3 = await api().get('/api/v1/doctors?page=3&limit=5').set('Cookie', viewerCookie());

    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(5);
    expect(page1.body.meta).toEqual({
      page: 1,
      limit: 5,
      total: 12,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: false,
    });
    expect(page3.body.data).toHaveLength(2);
    expect(page3.body.meta.hasNextPage).toBe(false);
  });

  it('caps the page size at 100', async () => {
    const res = await api().get('/api/v1/doctors?limit=1000').set('Cookie', viewerCookie());
    expect(res.status).toBe(400);
  });

  it('searches by word prefix across name, hospital and email', async () => {
    await createDoctor({ name: 'Johanna Smithson', hospital: 'Northgate Medical Center' });
    await createDoctor({ name: 'Mark Jones', email: 'mark.jones@clinic.dev' });
    await createDoctor({ name: 'Priya Raman' });
    await createDoctor({ name: 'José Álvarez' });

    const search = async (q: string) =>
      (
        await api().get('/api/v1/doctors').query({ search: q }).set('Cookie', viewerCookie())
      ).body.data.map((d: { name: string }) => d.name);

    expect(await search('jo sm')).toEqual(['Johanna Smithson']);
    expect(await search('SMITH')).toEqual(['Johanna Smithson']);
    expect(await search('northgate')).toEqual(['Johanna Smithson']);
    expect(await search('mark.jones@clinic')).toEqual(['Mark Jones']);
    expect(await search('.*')).toEqual([]);
    expect(await search('jose alv')).toEqual(['José Álvarez']);
    expect(await search('JOSÉ')).toEqual(['José Álvarez']);
  });

  it('filters by specialization (multi-value), hospital and creation date', async () => {
    await createDoctor({ specialization: 'Neurology', hospital: 'A Hospital' });
    await createDoctor({ specialization: 'Oncology', hospital: 'B Hospital' });
    await createDoctor({ specialization: 'Cardiology', hospital: 'A Hospital' });
    const old = await createDoctor({ specialization: 'Neurology' });
    await old.collection.updateOne(
      { _id: old._id },
      { $set: { createdAt: new Date('2020-01-01') } },
    );

    const get = (query: Record<string, string>) =>
      api().get('/api/v1/doctors').query(query).set('Cookie', viewerCookie());

    expect((await get({ specialization: 'Neurology,Oncology' })).body.meta.total).toBe(3);
    expect((await get({ hospital: 'A Hospital' })).body.meta.total).toBe(2);
    expect((await get({ from: '2019-12-01', to: '2020-01-01' })).body.meta.total).toBe(1);
    expect((await get({ from: '2021-01-01' })).body.meta.total).toBe(3);
  });

  it('rejects an inverted date range', async () => {
    const res = await api()
      .get('/api/v1/doctors?from=2026-02-01&to=2026-01-01')
      .set('Cookie', viewerCookie());
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('query.to');
  });

  it('includes each doctor’s patient count', async () => {
    const busy = await createDoctor();
    await createDoctor();
    await createPatient(busy._id);
    await createPatient(busy._id);

    const res = await api().get('/api/v1/doctors?sort=name_asc').set('Cookie', viewerCookie());
    const counts = Object.fromEntries(
      res.body.data.map((d: { id: string; patientCount: number }) => [d.id, d.patientCount]),
    );

    expect(counts[busy._id.toString()]).toBe(2);
    expect(Object.values(counts)).toContain(0);
  });
});

describe('GET /api/v1/doctors/:id', () => {
  it('returns the doctor with a patient breakdown by condition', async () => {
    const doctor = await createDoctor();
    await createPatient(doctor._id, { condition: 'critical' });
    await createPatient(doctor._id, { condition: 'stable' });

    const res = await api().get(`/api/v1/doctors/${doctor._id}`).set('Cookie', viewerCookie());

    expect(res.status).toBe(200);
    expect(res.body.data.patientCount).toBe(2);
    expect(res.body.data.patientsByCondition).toMatchObject({
      critical: 1,
      stable: 1,
      discharged: 0,
    });
  });

  it('returns 400 for a malformed id and 404 for an unknown one', async () => {
    const malformed = await api().get('/api/v1/doctors/not-an-id').set('Cookie', viewerCookie());
    const unknown = await api()
      .get('/api/v1/doctors/64b7f0c2a1b2c3d4e5f60718')
      .set('Cookie', viewerCookie());

    expect(malformed.status).toBe(400);
    expect(unknown.status).toBe(404);
  });
});

describe('PATCH / DELETE /api/v1/doctors/:id', () => {
  it('updates a doctor and keeps search in sync', async () => {
    const doctor = await createDoctor();

    const res = await api()
      .patch(`/api/v1/doctors/${doctor._id}`)
      .set('Cookie', adminCookie())
      .send({ name: 'Renamed Person' });
    const found = await api().get('/api/v1/doctors?search=renamed').set('Cookie', viewerCookie());

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed Person');
    expect(found.body.meta.total).toBe(1);
  });

  it('rejects an empty update', async () => {
    const doctor = await createDoctor();
    const res = await api()
      .patch(`/api/v1/doctors/${doctor._id}`)
      .set('Cookie', adminCookie())
      .send({});
    expect(res.status).toBe(400);
  });

  it('refuses to delete a doctor who still has patients', async () => {
    const doctor = await createDoctor();
    await createPatient(doctor._id);

    const res = await api().delete(`/api/v1/doctors/${doctor._id}`).set('Cookie', adminCookie());

    expect(res.status).toBe(409);
  });

  it('deletes a doctor without patients', async () => {
    const doctor = await createDoctor();

    const res = await api().delete(`/api/v1/doctors/${doctor._id}`).set('Cookie', adminCookie());
    const after = await api().get(`/api/v1/doctors/${doctor._id}`).set('Cookie', viewerCookie());

    expect(res.status).toBe(204);
    expect(after.status).toBe(404);
  });
});

describe('/api/v1/doctors/:id/patients', () => {
  it('adds a patient under a doctor and lists only that doctor’s patients', async () => {
    const doctor = await createDoctor();
    const other = await createDoctor();
    await createPatient(other._id);

    const created = await api()
      .post(`/api/v1/doctors/${doctor._id}/patients`)
      .set('Cookie', adminCookie())
      .send(patientPayload());
    const list = await api()
      .get(`/api/v1/doctors/${doctor._id}/patients`)
      .set('Cookie', viewerCookie());

    expect(created.status).toBe(201);
    expect(created.body.data.doctor).toMatchObject({
      id: doctor._id.toString(),
      name: doctor.name,
    });
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0].id).toBe(created.body.data.id);
  });

  it('returns 404 when adding a patient to an unknown doctor', async () => {
    const res = await api()
      .post('/api/v1/doctors/64b7f0c2a1b2c3d4e5f60718/patients')
      .set('Cookie', adminCookie())
      .send(patientPayload());
    expect(res.status).toBe(404);
  });

  it('removes a patient from a doctor’s list only if they belong to that doctor', async () => {
    const doctor = await createDoctor();
    const other = await createDoctor();
    const patient = await createPatient(doctor._id);

    const wrongDoctor = await api()
      .delete(`/api/v1/doctors/${other._id}/patients/${patient._id}`)
      .set('Cookie', adminCookie());
    const ok = await api()
      .delete(`/api/v1/doctors/${doctor._id}/patients/${patient._id}`)
      .set('Cookie', adminCookie());

    expect(wrongDoctor.status).toBe(404);
    expect(ok.status).toBe(204);
    expect(await Patient.exists({ _id: patient._id })).toBeNull();
  });
});

describe('GET /api/v1/doctors/lookup', () => {
  it('returns a small id/name list sorted by name', async () => {
    await createDoctor({ name: 'Zed Adams' });
    await createDoctor({ name: 'Amy Brown' });

    const res = await api().get('/api/v1/doctors/lookup').set('Cookie', viewerCookie());

    expect(res.status).toBe(200);
    expect(res.body.data.map((d: { name: string }) => d.name)).toEqual(['Amy Brown', 'Zed Adams']);
    expect(Object.keys(res.body.data[0]).sort()).toEqual(['id', 'name', 'specialization']);
  });
});
