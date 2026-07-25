import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { ApiError } from '../../lib/errors.js';

/**
 * Dev-only router — minted tokens for any seeded admin account.
 * Never mounted in production (see app.ts guard).
 */
const router = Router();

router.post(
  '/dev/login',
  asyncHandler(async (req, res) => {
    const { email } = req.body as { email?: string };
    if (!email) throw ApiError.badRequest('email is required');

    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin) throw ApiError.notFound('Admin user');

    const secret = process.env['JWT_SECRET'];
    if (!secret) throw new Error('JWT_SECRET not set');

    const token = jwt.sign(
      { sub: admin.id, role: admin.role, museumId: admin.museumId },
      secret,
      { expiresIn: '12h' },
    );

    res.json({ token, role: admin.role, museumId: admin.museumId });
  }),
);

export { router as devRouter };
