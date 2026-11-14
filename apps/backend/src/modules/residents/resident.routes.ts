import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireResident } from '../../middleware/rbac';
import {
  addPhoneHandler,
  getConsentHandler,
  getPreferencesHandler,
  getProfileHandler,
  listAlertHistoryHandler,
  listAnnouncementsHandler,
  listOwnReportsHandler,
  listPhonesHandler,
  removePhoneHandler,
  setConsentHandler,
  setPreferencesHandler,
  updateProfileHandler
} from './resident.controller';

export const residentRouter = Router();

residentRouter.use('/residents/me', authenticate, requireResident);

residentRouter.get('/residents/me', getProfileHandler);
residentRouter.patch('/residents/me', updateProfileHandler);

residentRouter.get('/residents/me/phones', listPhonesHandler);
residentRouter.post('/residents/me/phones', addPhoneHandler);
residentRouter.delete('/residents/me/phones/:phoneId', removePhoneHandler);

residentRouter.get('/residents/me/consent', getConsentHandler);
residentRouter.put('/residents/me/consent', setConsentHandler);

residentRouter.get('/residents/me/preferences', getPreferencesHandler);
residentRouter.put('/residents/me/preferences', setPreferencesHandler);

residentRouter.get('/residents/me/announcements', listAnnouncementsHandler);
residentRouter.get('/residents/me/reports', listOwnReportsHandler);
residentRouter.get('/residents/me/alert-history', listAlertHistoryHandler);
