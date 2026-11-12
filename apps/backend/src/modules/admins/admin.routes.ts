import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireAdmin, requireRoles } from '../../middleware/rbac';
import { createAdminHandler, listAdminsHandler, updateAdminHandler } from './admin.controller';

export const adminRouter = Router();

adminRouter.use('/admin/administrators', authenticate, requireAdmin, requireRoles('SUPERADMIN'));

adminRouter.get('/admin/administrators', listAdminsHandler);
adminRouter.post('/admin/administrators', createAdminHandler);
adminRouter.patch('/admin/administrators/:adminId', updateAdminHandler);
