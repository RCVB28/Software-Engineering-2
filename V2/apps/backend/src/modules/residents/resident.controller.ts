import { AlertCategory, ResidentRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError, asyncHandler } from '../../middleware/error';
import { assert, optionalString, parseEnum, requireString } from '../../middleware/validation';
import {
  addPhone,
  getConsent,
  getPreferences,
  getProfile,
  listAnnouncements,
  listOwnReports,
  listPhones,
  removePhone,
  setConsent,
  setPreferences,
  updateProfile,
  type PreferenceInput
} from './resident.service';

export const getProfileHandler = asyncHandler(async (req, res) => {
  res.json(await getProfile(prisma, req.user!.id));
});

export const updateProfileHandler = asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  res.json(
    await updateProfile(prisma, req.user!.id, {
      ...(body.displayName !== undefined
        ? { displayName: optionalString(body.displayName, 'displayName', 120) }
        : {}),
      ...(body.role !== undefined
        ? { role: parseEnum(body.role, Object.values(ResidentRole), 'role') }
        : {}),
      ...(body.barangayId !== undefined
        ? { barangayId: requireString(body.barangayId, 'barangayId') }
        : {}),
      ...(body.buildingTag !== undefined
        ? { buildingTag: optionalString(body.buildingTag, 'buildingTag', 120) }
        : {})
    })
  );
});

export const listPhonesHandler = asyncHandler(async (req, res) => {
  res.json(await listPhones(prisma, req.user!.id));
});

export const addPhoneHandler = asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const number = requireString(body.number, 'number');
  assert(typeof (body.isPrimary ?? false) === 'boolean', 'isPrimary must be a boolean');
  res.status(201).json(await addPhone(prisma, req.user!.id, number, Boolean(body.isPrimary)));
});

export const removePhoneHandler = asyncHandler(async (req, res) => {
  await removePhone(prisma, req.user!.id, req.params.phoneId);
  res.status(204).send();
});

export const getConsentHandler = asyncHandler(async (req, res) => {
  res.json(await getConsent(prisma, req.user!.id));
});

export const setConsentHandler = asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  assert(typeof body.granted === 'boolean', 'granted must be a boolean');
  const policyVersion = requireString(body.policyVersion, 'policyVersion', 50);
  res.json(await setConsent(prisma, req.user!.id, { granted: body.granted, policyVersion }));
});

export const getPreferencesHandler = asyncHandler(async (req, res) => {
  res.json(await getPreferences(prisma, req.user!.id));
});

export const setPreferencesHandler = asyncHandler(async (req, res) => {
  if (!Array.isArray(req.body)) {
    throw new AppError(400, 'Expected an array of preferences', 'VALIDATION_ERROR');
  }
  const preferences: PreferenceInput[] = req.body.map(
    (item: unknown, index: number): PreferenceInput => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new AppError(400, `preferences[${index}] must be an object`, 'VALIDATION_ERROR');
      }
      const preference = item as Record<string, unknown>;
      assert(
        typeof preference.optedIn === 'boolean',
        `preferences[${index}].optedIn must be a boolean`
      );
      return {
        category: parseEnum(
          preference.category,
          Object.values(AlertCategory),
          `preferences[${index}].category`
        ),
        optedIn: preference.optedIn as boolean
      };
    }
  );
  res.json(await setPreferences(prisma, req.user!.id, preferences));
});

export const listAnnouncementsHandler = asyncHandler(async (req, res) => {
  res.json(await listAnnouncements(prisma, req.user!.id));
});

export const listOwnReportsHandler = asyncHandler(async (req, res) => {
  res.json(await listOwnReports(prisma, req.user!.id));
});
