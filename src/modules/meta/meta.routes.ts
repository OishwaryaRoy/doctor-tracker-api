import { Router } from 'express';
import {
  BLOOD_GROUPS,
  GENDERS,
  PATIENT_CONDITIONS,
  SPECIALIZATIONS,
} from '../../constants/domain.js';
import { listHospitals } from '../doctors/doctor.service.js';

export const metaRouter = Router();

metaRouter.get('/options', async (_req, res) => {
  res.json({
    data: {
      specializations: SPECIALIZATIONS,
      conditions: PATIENT_CONDITIONS,
      genders: GENDERS,
      bloodGroups: BLOOD_GROUPS,
      hospitals: await listHospitals(),
    },
  });
});
