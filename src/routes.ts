import { Router } from 'express';
import { requireAuth } from './middleware/auth.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { doctorRouter } from './modules/doctors/doctor.routes.js';
import { metaRouter } from './modules/meta/meta.routes.js';
import { patientRouter } from './modules/patients/patient.routes.js';
import { statsRouter } from './modules/stats/stats.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);

apiRouter.use(requireAuth);
apiRouter.use('/doctors', doctorRouter);
apiRouter.use('/patients', patientRouter);
apiRouter.use('/stats', statsRouter);
apiRouter.use('/meta', metaRouter);
