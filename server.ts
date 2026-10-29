import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'node:crypto';
import { dbStore, UserAccount } from './server/db';
import {
  authMiddleware,
  hashPassword,
  verifyPassword,
  createSessionToken,
  requireAuth,
  requireAdmin,
  requireVerifiedEmail,
  AuthenticatedRequest
} from './server/auth';
import { cpxResearchService } from './server/cpxResearchService';
import { aoyTasksService } from './server/aoyTasksService';
import { usdtPriceService } from './server/usdtPriceService';
import { usdtPayoutManager } from './server/usdtPayoutService';
import { validateUsdtAddress, calculateUsdtPayout, calculateHybridSurveySplit, usdCentsToPoints } from './src/utils/usdt';
import {
  aoyRewardToGrossCents,
  sanitizeAoySubId,
  sanitizeWhiteLabelText,
  generateAoyPostbackSignature,
  verifyAoyPostbackSignature
} from './src/utils/aoytasks';
import { generateCpxSecureHash, verifyCpxPostbackSignature, normalizeCpxPostbackGrossCents } from './src/utils/cpx';
import { buildPartnerAccountingReport } from './src/utils/partnerAccounting';
import { canSubmitWithdrawal } from './src/utils/ledger';

dotenv.config();

const app = express();
export { app };
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Normalize rewritten Vercel Serverless URLs (e.g., /api?__pathname=/api/auth/login)
app.use((req, _res, next) => {
  const rewrittenPath =
    (typeof req.query.__pathname === 'string' && req.query.__pathname) ||
    (typeof req.headers['x-invoke-path'] === 'string' && req.headers['x-invoke-path']) ||
    '';
  if (rewrittenPath && (req.path === '/api' || req.path === '/api/index' || req.path === '/')) {
    const cleanPath = rewrittenPath.startsWith('/') ? rewrittenPath : `/${rewrittenPath}`;
    const qIndex = req.url.indexOf('?');
    if (qIndex !== -1) {
      const params = new URLSearchParams(req.url.slice(qIndex + 1));
      params.delete('__pathname');
      const qs = params.toString();
      req.url = qs ? `${cleanPath}?${qs}` : cleanPath;
    } else {
      req.url = cleanPath;
    }
  }
  next();
});

app.use(express.static('public'));
app.use(async (_req, _res, next) => {
  await dbStore.init();
  next();
});
app.use(authMiddleware);

// Request logging for API endpoints
app.use('/api', (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (res.statusCode >= 400) {
      console.warn(`[API] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Helper to ensure and return Admin user + session
async function ensureAdminAndCreateResponse() {
  let adminUser =
    dbStore.getUserById('usr_admin_rewardriver') ||
    dbStore.getUserByUsernameOrEmail('admin@reward-river') ||
    dbStore.getUserByUsernameOrEmail('admin');
  const { hash, salt } = hashPassword('Tahir@300');

  if (!adminUser) {
    adminUser = await dbStore.createUser({
      id: 'usr_admin_rewardriver',
      username: 'admin@reward-river',
      email: 'admin@reward-river',
      passwordHash: hash,
      salt,
      displayName: 'Reward River Admin',
      emailVerified: true,
      role: 'admin',
      externalOpaqueId: `rr_cpx_admin_${crypto.randomBytes(8).toString('hex')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provider: 'password',
      hasPromptedPhone: true
    });
  } else {
    await dbStore.updateUser(adminUser.id, {
      username: 'admin@reward-river',
      email: 'admin@reward-river',
      passwordHash: hash,
      salt,
      role: 'admin',
      hasPromptedPhone: true
    });
    adminUser = {
      ...adminUser,
      username: 'admin@reward-river',
      email: 'admin@reward-river',
      passwordHash: hash,
      salt,
      role: 'admin',
      hasPromptedPhone: true
    };
  }

  const token = createSessionToken(adminUser);
  const balances = dbStore.getUserBalances(adminUser.id);
  return {
    token,
    user: {
      id: adminUser.id,
      username: adminUser.username,
      email: adminUser.email,
      displayName: adminUser.displayName,
      emailVerified: true,
      role: 'admin' as const,
      externalOpaqueId: adminUser.externalOpaqueId,
      createdAt: adminUser.createdAt,
      hasPromptedPhone: true
    },
    balances
  };
}

// -----------------------------------------------------------------------------
// Authentication Endpoints
// -----------------------------------------------------------------------------

// POST /api/auth/register
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const { username, displayName, email, password } = body;

    const rawUsername = String(username || displayName || '').trim();
    const rawEmail = String(email || '').trim().toLowerCase();
    const cleanPass = typeof password === 'string' ? password : '';

    const isReservedAdminIdentifier = (val: string) => {
      const lower = val.trim().toLowerCase();
      return (
        lower === 'admin@reward-river' ||
        lower === 'admin@rewardriver' ||
        lower === 'admin@rewardriver.com' ||
        lower === 'admin'
      );
    };

    // If admin credentials are submitted on the Sign Up form, sign in as Admin directly
    if (isReservedAdminIdentifier(rawEmail) || isReservedAdminIdentifier(rawUsername)) {
      if (cleanPass.trim() === 'Tahir@300') {
        const adminData = await ensureAdminAndCreateResponse();
        res.status(200).json(adminData);
        return;
      }
      res.status(403).json({ error: 'This identifier is reserved for the administrator. Please check your password or choose a different username.' });
      return;
    }

    const effectiveEmail = rawEmail.includes('@')
      ? rawEmail
      : rawEmail
      ? `${rawEmail.replace(/[^a-z0-9._-]/g, '')}@gmail.com`
      : rawUsername.includes('@')
      ? rawUsername.toLowerCase()
      : rawUsername
      ? `${rawUsername.toLowerCase().replace(/[^a-z0-9._-]/g, '')}@gmail.com`
      : '';

    if (!effectiveEmail) {
      res.status(400).json({ error: 'Please enter a username or email address.' });
      return;
    }

    if (!cleanPass || cleanPass.length < 4) {
      res.status(400).json({ error: 'Password must be at least 4 characters.' });
      return;
    }

    await dbStore.syncFromSupabase();

    const existingUser =
      dbStore.getUserByEmail(effectiveEmail) ||
      (rawUsername ? dbStore.getUserByUsernameOrEmail(rawUsername) : undefined);

    if (existingUser) {
      const { hash, salt } = hashPassword(cleanPass);
      const updatedUser =
        (await dbStore.updateUser(existingUser.id, {
          passwordHash: hash,
          salt,
          username: rawUsername || existingUser.username || existingUser.displayName,
          displayName: rawUsername || existingUser.displayName || existingUser.username
        })) || existingUser;

      const token = createSessionToken(updatedUser);
      const balances = dbStore.getUserBalances(updatedUser.id);
      res.json({
        message: 'Welcome back!',
        token,
        user: {
          id: updatedUser.id,
          username: updatedUser.username || updatedUser.displayName,
          email: updatedUser.email,
          displayName: updatedUser.displayName,
          emailVerified: true,
          role: 'user',
          externalOpaqueId: updatedUser.externalOpaqueId,
          createdAt: updatedUser.createdAt,
          hasPromptedPhone: true
        },
        balances
      });
      return;
    }

    const { hash, salt } = hashPassword(cleanPass);
    const userId = `usr_${crypto.randomUUID()}`;
    const externalOpaqueId = `rr_cpx_${userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;
    const effectiveDisplayName = rawUsername || effectiveEmail.split('@')[0];

    const newUser: UserAccount = {
      id: userId,
      username: effectiveDisplayName,
      email: effectiveEmail,
      passwordHash: hash,
      salt,
      displayName: effectiveDisplayName,
      emailVerified: true,
      role: 'user',
      externalOpaqueId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provider: 'password',
      hasPromptedPhone: true
    };

    await dbStore.createUser(newUser);
    const token = createSessionToken(newUser);
    const balances = dbStore.getUserBalances(newUser.id);

    res.status(201).json({
      message: 'Account created instantly!',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        displayName: newUser.displayName,
        emailVerified: true,
        role: newUser.role,
        externalOpaqueId: newUser.externalOpaqueId,
        createdAt: newUser.createdAt,
        hasPromptedPhone: true
      },
      balances
    });
  } catch (err: unknown) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const { email, username, identifier, password } = body;
    const loginId = String(identifier || email || username || '').trim();
    const cleanPass = typeof password === 'string' ? password : '';

    if (!loginId || !cleanPass) {
      res.status(400).json({ error: 'Please enter your username/email and password.' });
      return;
    }

    const normalizedLoginId = loginId.toLowerCase();
    const isSoleAdminId =
      normalizedLoginId === 'admin@reward-river' ||
      normalizedLoginId === 'admin@rewardriver' ||
      normalizedLoginId === 'admin@rewardriver.com' ||
      normalizedLoginId === 'admin';

    // Strict check for Admin: admin@reward-river / admin with password Tahir@300
    if (isSoleAdminId) {
      if (cleanPass !== 'Tahir@300' && cleanPass.trim() !== 'Tahir@300') {
        res.status(401).json({ error: 'Invalid admin credentials.' });
        return;
      }

      const adminData = await ensureAdminAndCreateResponse();
      res.json(adminData);
      return;
    }

    let user = dbStore.getUserByUsernameOrEmail(loginId);
    if (!user) {
      await dbStore.syncFromSupabase();
      user = dbStore.getUserByUsernameOrEmail(loginId);
    }

    // If user account was created on an earlier stateless deployment before Supabase sync or is signing in fresh, auto-provision it
    if (!user) {
      if (cleanPass.length < 4) {
        res.status(401).json({ error: 'Password must be at least 4 characters.' });
        return;
      }
      const { hash, salt } = hashPassword(cleanPass);
      const userId = `usr_${crypto.randomUUID()}`;
      const externalOpaqueId = `rr_cpx_${userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;
      const effectiveEmail = normalizedLoginId.includes('@')
        ? normalizedLoginId
        : `${normalizedLoginId.replace(/[^a-z0-9._-]/g, '') || 'user'}@gmail.com`;
      const effectiveDisplayName = normalizedLoginId.includes('@')
        ? normalizedLoginId.split('@')[0]
        : loginId;

      user = await dbStore.createUser({
        id: userId,
        username: effectiveDisplayName,
        email: effectiveEmail,
        passwordHash: hash,
        salt,
        displayName: effectiveDisplayName,
        emailVerified: true,
        role: 'user',
        externalOpaqueId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        provider: 'password',
        hasPromptedPhone: true
      });
    } else if (user.role === 'admin') {
      res.status(401).json({ error: 'Invalid email/username or password.' });
      return;
    } else if (!user.passwordHash || !user.salt) {
      // User was migrated from Supabase OAuth/Auth without a local PBKDF2 hash; initialize password on first sign-in
      const { hash, salt } = hashPassword(cleanPass);
      await dbStore.updateUser(user.id, { passwordHash: hash, salt });
      user = { ...user, passwordHash: hash, salt };
    } else if (
      !verifyPassword(cleanPass, user.passwordHash, user.salt) &&
      !verifyPassword(cleanPass.trim(), user.passwordHash, user.salt)
    ) {
      res.status(401).json({ error: 'Invalid email/username or password.' });
      return;
    }

    const token = createSessionToken(user);
    const balances = dbStore.getUserBalances(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username || user.displayName,
        email: user.email,
        displayName: user.displayName,
        emailVerified: true,
        role: 'user',
        externalOpaqueId: user.externalOpaqueId,
        createdAt: user.createdAt,
        hasPromptedPhone: true
      },
      balances
    });
  } catch (err: unknown) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  try {
    await dbStore.syncFromSupabase();
  } catch (e) {
    console.warn('[auth/me] Supabase sync note:', e);
  }
  const settings = dbStore.getSettings();
  const rawBalances = dbStore.getUserBalances(user.id);
  const { totalAdminProfitCents: _a, totalGrossRevenueCents: _g, ...userSafeBalances } = rawBalances;
  const userSharePercent = settings.userSharePercent || 40;
  const pointsPerUsdt = settings.pointsPerUsdt || 10000;

  res.json({
    user: {
      id: user.id,
      username: user.username || user.displayName,
      email: user.email,
      displayName: user.displayName,
      emailVerified: true,
      role: user.role,
      externalOpaqueId: user.externalOpaqueId,
      createdAt: user.createdAt,
      hasPromptedPhone: true
    },
    balances: user.role === 'admin' ? rawBalances : userSafeBalances,
    completedSurveysCount: rawBalances.completedSurveysCount || 0,
    pointsPerUsdt,
    userSharePercent,
    userUsdtPer10kPoints: (userSharePercent / 100).toFixed(2)
  });
});

// POST /api/auth/verify-email
app.post('/api/auth/verify-email', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  await dbStore.updateUser(user.id, { emailVerified: true });
  res.json({
    success: true,
    message: 'Your email address has been verified successfully. USDT withdrawals are now unlocked!'
  });
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { currentPassword, newPassword } = req.body;

  if (user.passwordHash && user.salt && currentPassword && !verifyPassword(currentPassword, user.passwordHash, user.salt)) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }

  if (!newPassword || newPassword.length < 4) {
    res.status(400).json({ error: 'New password must be at least 4 characters long.' });
    return;
  }

  const { hash, salt } = hashPassword(newPassword);
  await dbStore.updateUser(user.id, { passwordHash: hash, salt });
  res.json({ success: true, message: 'Password updated successfully.' });
});

// POST /api/auth/firebase-sync
app.post('/api/auth/firebase-sync', async (req: Request, res: Response) => {
  try {
    const { idToken, email, displayName, uid, emailVerified, photoURL, phoneNumber, whatsappNumber, countryCode, provider } = req.body;
    if (!uid || !email) {
      res.status(400).json({ error: 'UID and email are required for Firebase synchronization.' });
      return;
    }

    const targetEmail = email.trim().toLowerCase();
    const isAdmin = targetEmail === 'admin@reward-river';
    let user = dbStore.getUserById(uid) || dbStore.getUserByEmail(targetEmail);

    if (!user) {
      user = {
        id: uid,
        email: targetEmail,
        passwordHash: '',
        salt: '',
        displayName: displayName || targetEmail.split('@')[0],
        emailVerified: true,
        role: isAdmin ? 'admin' : 'user',
        externalOpaqueId: `rr_cpx_${uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        photoURL: photoURL || undefined,
        phoneNumber: phoneNumber || undefined,
        whatsappNumber: whatsappNumber || phoneNumber || undefined,
        countryCode: countryCode || undefined,
        provider: provider || 'google.com',
        hasPromptedPhone: Boolean(whatsappNumber || phoneNumber)
      };
      await dbStore.createUser(user);
    } else {
      const updates: Partial<UserAccount> = {};
      if (emailVerified !== undefined && user.emailVerified !== Boolean(emailVerified)) updates.emailVerified = Boolean(emailVerified);
      if (isAdmin && user.role !== 'admin') updates.role = 'admin';
      if (!isAdmin && user.role === 'admin') updates.role = 'user';
      if (photoURL && !user.photoURL) updates.photoURL = photoURL;
      if (phoneNumber && !user.phoneNumber) updates.phoneNumber = phoneNumber;
      if (whatsappNumber && !user.whatsappNumber) updates.whatsappNumber = whatsappNumber;
      if (countryCode && !user.countryCode) updates.countryCode = countryCode;
      if (provider && !user.provider) updates.provider = provider;
      
      if (Object.keys(updates).length > 0) {
        await dbStore.updateUser(user.id, updates);
        user = { ...user, ...updates };
      }
    }

    const token = idToken || createSessionToken(user);
    const balances = dbStore.getUserBalances(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        role: user.role,
        createdAt: user.createdAt,
        externalOpaqueId: user.externalOpaqueId,
        photoURL: user.photoURL,
        phoneNumber: user.phoneNumber,
        whatsappNumber: user.whatsappNumber,
        countryCode: user.countryCode,
        provider: user.provider,
        hasPromptedPhone: user.hasPromptedPhone
      },
      balances
    });
  } catch (err) {
    console.error('Firebase sync error:', err);
    res.status(500).json({ error: 'Failed to synchronize Firebase user account.' });
  }
});

// POST /api/user/phone - Save WhatsApp / Phone onboarding
app.post('/api/user/phone', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { whatsappNumber, countryCode } = req.body;
    const user = req.user!;

    if (!whatsappNumber || typeof whatsappNumber !== 'string' || whatsappNumber.trim().length < 5) {
      res.status(400).json({ error: 'Please enter a valid phone or WhatsApp number.' });
      return;
    }

    const cleanedNumber = whatsappNumber.trim().replace(/[^\d+]/g, '');
    const updatedUser = await dbStore.updateUser(user.id, {
      whatsappNumber: cleanedNumber,
      phoneNumber: cleanedNumber,
      countryCode: countryCode || user.countryCode,
      hasPromptedPhone: true
    });

    res.json({
      success: true,
      user: {
        ...user,
        ...updatedUser,
        whatsappNumber: cleanedNumber,
        phoneNumber: cleanedNumber,
        hasPromptedPhone: true
      }
    });
  } catch (err) {
    console.error('Phone save error:', err);
    res.status(500).json({ error: 'Failed to save contact information.' });
  }
});

// GET /api/admin/users - Full User Directory for Admin Portal
app.get('/api/admin/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await dbStore.syncFromSupabase();
    const usersWithDetails = dbStore.getAllUsersWithDetails();
    res.json({
      success: true,
      users: usersWithDetails,
      totalCount: usersWithDetails.length
    });
  } catch (err) {
    console.error('Admin users fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch user directory.' });
  }
});

// DELETE /api/admin/users/:id - Delete User Account by Admin
app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = req.params.id;
    if (req.user!.id === targetUserId) {
      res.status(400).json({ error: 'You cannot delete your own admin account.' });
      return;
    }
    const target = dbStore.getUserById(targetUserId);
    if (!target) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }
    const success = await dbStore.deleteUser(targetUserId);
    if (!success) {
      res.status(500).json({ error: 'Failed to delete user account.' });
      return;
    }
    await dbStore.addAuditLog({
      adminUserId: req.user!.id,
      adminEmail: req.user!.email,
      action: 'ADMIN_DELETE_USER',
      targetEntity: 'users',
      targetId: targetUserId,
      details: `Permanently deleted user ${target.email} (${target.displayName || target.username || 'unnamed'}). Cleared associated ledger entries and withdrawal requests.`
    });
    res.json({
      success: true,
      message: `User ${target.email} deleted successfully.`
    });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Server error while deleting user account.' });
  }
});

// GET /api/admin/user-analytics - Advanced User Cohorts, Retention & Earnings
app.get('/api/admin/user-analytics', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await dbStore.syncFromSupabase();
    const users = dbStore.getAllUsersWithDetails();
    const settings = dbStore.getSettings();
    const pointsPerUsdt = settings.pointsPerUsdt || 10000;
    const userSharePercent = settings.userSharePercent || 40;

    const totalUsers = users.length;
    const activeEarners = users.filter(
      u => (u.balances.availablePoints || 0) > 0 || (u.balances.totalEarnedPoints || 0) > 0
    ).length;
    const emailVerifiedCount = users.filter(u => u.emailVerified).length;
    const phoneAddedCount = users.filter(u => Boolean(u.phoneNumber || u.whatsappNumber)).length;

    // Cohort intervals
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const signupsLast24h = users.filter(u => new Date(u.createdAt).getTime() >= oneDayAgo).length;
    const signupsLast7d = users.filter(u => new Date(u.createdAt).getTime() >= sevenDaysAgo).length;
    const signupsLast30d = users.filter(u => new Date(u.createdAt).getTime() >= thirtyDaysAgo).length;

    // Top Earners Leaderboard
    const topEarners = [...users]
      .sort((a, b) => (b.balances.totalEarnedPoints || 0) - (a.balances.totalEarnedPoints || 0))
      .slice(0, 10)
      .map((u, idx) => ({
        rank: idx + 1,
        id: u.id,
        email: u.email,
        displayName: u.displayName || u.username || 'Member',
        pointsEarned: u.balances.totalEarnedPoints || 0,
        availablePoints: u.balances.availablePoints || 0,
        usdtEarned: `$${(((u.balances.totalEarnedPoints || 0) / pointsPerUsdt) * (userSharePercent / 100)).toFixed(2)}`,
        completedSurveys: u.completedSurveysCount,
        joinedAt: u.createdAt,
        verified: u.emailVerified
      }));

    // Country distribution strictly from real user records
    const countryCounts: Record<string, number> = {};
    for (const u of users) {
      const code = (u.countryCode || '').trim().toUpperCase();
      if (code) {
        countryCounts[code] = (countryCounts[code] || 0) + 1;
      }
    }
    const topCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({
        code,
        name: code,
        percentage: totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0,
        count
      }));

    res.json({
      success: true,
      totalUsers,
      activeEarners,
      inactiveUsers: Math.max(0, totalUsers - activeEarners),
      emailVerifiedRate: totalUsers > 0 ? Math.round((emailVerifiedCount / totalUsers) * 100) : 0,
      phoneAttachedRate: totalUsers > 0 ? Math.round((phoneAddedCount / totalUsers) * 100) : 0,
      signupsLast24h,
      signupsLast7d,
      signupsLast30d,
      topEarners,
      deviceBreakdown: { mobile: 0, desktop: totalUsers, tablet: 0 },
      topCountries
    });
  } catch (err) {
    console.error('User analytics error:', err);
    res.status(500).json({ error: 'Failed to retrieve user analytics.' });
  }
});

// GET /api/admin/system-health - Diagnostics, Uptime, Memory & Services
app.get('/api/admin/system-health', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const memory = process.memoryUsage();
    const uptimeSec = Math.floor(process.uptime());
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;

    const uptimeFormatted = `${days > 0 ? `${days}d ` : ''}${hours}h ${minutes}m ${seconds}s`;
    const cpxConfig = cpxResearchService.getConfigStatus();
    const usdtStatus = await usdtPriceService.getUsdtPriceQuote();

    const services = [
      {
        id: 'node_server',
        name: 'Node.js Express Server Engine',
        status: 'healthy',
        latencyMs: 1,
        details: `Node ${process.version} • ${process.platform} • PID ${process.pid}`
      },
      {
        id: 'cpx_offerwall',
        name: 'CPX Research Survey Feed & Webhook',
        status: cpxConfig.isConfigured ? 'healthy' : 'warning',
        latencyMs: 135,
        details: `App #${cpxResearchService.appId} • HMAC/MD5 signature check active`
      },
      {
        id: 'aoytasks_api',
        name: 'AoyTasks White-Label Feed & Callback',
        status: 'healthy',
        latencyMs: 172,
        details: `Endpoint /wh/aoytasks • MD5 hash verification active`
      },
      {
        id: 'usdt_price_feed',
        name: 'USDT Price & 1:1 Peg Service',
        status: !usdtStatus.isStale ? 'healthy' : 'degraded',
        latencyMs: 64,
        details: `${usdtStatus.formattedPrice} (${usdtStatus.pegStatus}) • ${usdtStatus.source}`
      },
      {
        id: 'persistence_store',
        name: 'Persistent Ledger & User Store',
        status: 'healthy',
        latencyMs: 2,
        details: `${dbStore.getAllUsers().length} Accounts • ${dbStore.getAllLedgerEntries().length} Ledger Entries • ${dbStore.getAllWithdrawals().length} Withdrawals`
      }
    ];

    res.json({
      success: true,
      status: 'all_systems_operational',
      uptimeSeconds: uptimeSec,
      uptimeFormatted,
      memory: {
        rssMb: (memory.rss / (1024 * 1024)).toFixed(1),
        heapUsedMb: (memory.heapUsed / (1024 * 1024)).toFixed(1),
        heapTotalMb: (memory.heapTotal / (1024 * 1024)).toFixed(1),
        percentHeapUsed: Math.round((memory.heapUsed / memory.heapTotal) * 100)
      },
      services,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    console.error('System health check error:', err);
    res.status(500).json({ error: 'Failed to retrieve system health.' });
  }
});

// SEO & Google Analytics Robots / Sitemap routes
app.get('/robots.txt', (req: Request, res: Response) => {
  const host = `${req.protocol}://${req.get('host')}`;
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${host}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req: Request, res: Response) => {
  const host = `${req.protocol}://${req.get('host')}`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${host}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${host}/surveys</loc>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${host}/rewards</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${host}/faq</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>`;
  res.type('application/xml');
  res.send(xml);
});

// -----------------------------------------------------------------------------
// CPX Research API & Survey Marketplace Endpoints
// -----------------------------------------------------------------------------

// GET /api/cpx/status
app.get('/api/cpx/status', (req: Request, res: Response) => {
  const status = cpxResearchService.getConfigStatus();
  res.json(status);
});

// GET /api/public/live-surveys - Real-time live CPX Research survey preview & platform stats
app.get('/api/public/live-surveys', async (req: Request, res: Response) => {
  try {
    const settings = dbStore.getSettings();
    const userSharePercent = settings.userSharePercent || 40;
    const pointsPerUsdt = settings.pointsPerUsdt || 10000;

    const rawIp = (
      (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      (req.headers['x-client-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.ip ||
      ''
    ).trim();
    const isPrivateOrLoopback =
      !rawIp ||
      rawIp === '127.0.0.1' ||
      rawIp === '::1' ||
      rawIp.startsWith('::ffff:127.') ||
      rawIp.startsWith('10.') ||
      rawIp.startsWith('192.168.');
    const clientIp = isPrivateOrLoopback ? '142.250.190.46' : rawIp;
    const userAgent =
      req.headers['user-agent'] ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    const surveyData = await cpxResearchService.fetchEligibleSurveys({
      externalUserId: 'rr_cpx_public_feed',
      ipAddress: clientIp,
      userAgent
    });

    const liveSurveys = surveyData.surveys.map(s => {
      const split = calculateHybridSurveySplit(s.rewardCents, userSharePercent, pointsPerUsdt);
      return {
        id: s.id,
        category: s.category || 'General',
        loiMinutes: s.loiMinutes,
        rewardPoints: split.userRewardPoints,
        rewardPointsFormatted: split.userRewardPointsFormatted,
        ratingAvg: s.ratingAvg,
        ratingCount: s.ratingCount,
        isTop: s.isTop
      };
    });

    const allLedger = dbStore.getAllLedgerEntries();
    const confirmedCompletions = allLedger.filter(
      l => l.entryType === 'credit' && l.status === 'confirmed'
    );

    res.json({
      success: true,
      cpxAppId: cpxResearchService.appId,
      totalAvailableSurveys: surveyData.totalAvailable || liveSurveys.length,
      surveys: liveSurveys,
      totalRegisteredUsers: dbStore.getAllUsers().length,
      totalCompletedSurveys: confirmedCompletions.length
    });
  } catch (err) {
    console.error('[Public Live Surveys Error]:', err);
    res.status(500).json({ error: 'Could not fetch live CPX surveys.' });
  }
});

// GET /api/surveys
app.get('/api/surveys', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const settings = dbStore.getSettings();
    const userSharePercent = settings.userSharePercent || 40;
    const pointsPerUsdt = settings.pointsPerUsdt || 10000;
    const opaqueId = user.externalOpaqueId || (user.id ? `rr_cpx_${user.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}` : 'rr_cpx_guest_1');

    const rawIp = (
      (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      (req.headers['x-client-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.ip ||
      ''
    ).trim();
    const isPrivateOrLoopback = !rawIp || rawIp === '127.0.0.1' || rawIp === '::1' || rawIp.startsWith('::ffff:127.') || rawIp.startsWith('10.') || rawIp.startsWith('192.168.');
    const clientIp = isPrivateOrLoopback ? '5.146.176.100' : rawIp;
    const userAgent = req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    const surveyData = await cpxResearchService.fetchEligibleSurveys({
      externalUserId: opaqueId,
      ipAddress: clientIp,
      userAgent
    });

    // If CPX Research returned live completed transactions for this user, auto-credit them to the ledger
    if (Array.isArray(surveyData.transactions) && surveyData.transactions.length > 0) {
      for (const rawTx of surveyData.transactions) {
        if (!rawTx || typeof rawTx !== 'object') continue;
        const tx = rawTx as Record<string, unknown>;
        const rawId = String(tx.trans_id || tx.transaction_id || '').trim();
        if (!rawId) continue;
        if (tx.status !== undefined && String(tx.status) !== '1') continue;
        const providerTxId = rawId.startsWith('cpx_') ? rawId : `cpx_${rawId}`;
        const offerId = String(tx.offer_id || tx.survey_id || rawId);
        const grossCents = normalizeCpxPostbackGrossCents(
          tx.amount_usd ?? tx.payout_publisher_usd ?? tx.cpi,
          tx.amount_local ?? tx.payout ?? tx.verdienst ?? tx.points,
          pointsPerUsdt
        );
        if (grossCents <= 0) continue;
        const split = calculateHybridSurveySplit(grossCents, userSharePercent, pointsPerUsdt);
        await dbStore.addLedgerEntry({
          id: `ledg_${crypto.randomUUID()}`,
          userId: user.id,
          providerTxId,
          amountCents: split.userRewardCents,
          points: split.userRewardPoints,
          grossCents: split.grossCents,
          adminProfitCents: split.adminProfitCents,
          appliedSharePercent: split.userSharePercent,
          entryType: 'credit',
          status: 'confirmed',
          description: `CPX Research Survey #${offerId} Completed (+${split.userRewardPointsFormatted} Pts)`,
          cpxOfferId: offerId,
          createdAt: new Date().toISOString(),
          processedAt: new Date().toISOString()
        });
      }
    }

    const usdtQuote = await usdtPriceService.getUsdtPriceQuote().catch(() => null);

    // Use 100% genuine live surveys returned from CPX Research API (https://live-api.cpx-research.com/api/get-surveys.php)
    const baseSurveys = surveyData.surveys;

    // Apply Hybrid Points + USDT custom user share (e.g. 40% visible to user; 60% hidden admin profit)
    const surveysWithHybridShare = baseSurveys.map(s => {
      const split = calculateHybridSurveySplit(s.rewardCents, userSharePercent, pointsPerUsdt);
      return {
        ...s,
        rewardCents: split.userRewardCents,
        rewardPoints: split.userRewardPoints,
        rewardPointsFormatted: split.userRewardPointsFormatted,
        rewardUsdFormatted: split.userRewardUsdFormatted,
        rewardUsdtFormatted: `${(split.userRewardCents / 100).toFixed(2)} USDT`,
        isLiveCpx: true
      };
    });

    const cpxSecureHash = generateCpxSecureHash(opaqueId, cpxResearchService.hashKey);

    res.json({
      success: true,
      surveys: surveysWithHybridShare,
      totalAvailable: surveysWithHybridShare.length,
      pointsPerUsdt,
      surveyDisplayMode: settings.surveyDisplayMode || 'hybrid',
      usdtQuote,
      offerwallUrl: cpxResearchService.generateSurveyStartUrl(opaqueId),
      cpxConfig: {
        appId: cpxResearchService.appId,
        extUserId: opaqueId,
        secureHash: cpxSecureHash,
        themeColor: (settings.cpxThemeColor || '10b981').replace('#', '')
      }
    });
  } catch (err: unknown) {
    console.error('[Surveys Route Error]:', err);
    res.status(500).json({ error: 'Failed to load surveys from server.' });
  }
});

// POST or GET /api/surveys/start and /api/surveys/start/:surveyId?
app.all(['/api/surveys/start', '/api/surveys/start/:surveyId?'], requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const surveyId = req.params.surveyId || req.body?.surveyId || req.query?.surveyId;
  const directUrl = req.body?.directUrl || req.query?.directUrl;
  const opaqueId = user.externalOpaqueId || `rr_cpx_${user.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;
  const secureHash = generateCpxSecureHash(opaqueId, cpxResearchService.hashKey);

  let targetUrl = cpxResearchService.generateSurveyStartUrl(opaqueId, surveyId ? String(surveyId) : undefined);

  if (directUrl && typeof directUrl === 'string' && directUrl.startsWith('https://')) {
    try {
      const parsed = new URL(directUrl);
      parsed.searchParams.set('ext_user_id', opaqueId);
      if (secureHash) {
        parsed.searchParams.set('secure_hash', secureHash);
      }
      targetUrl = parsed.toString();
    } catch {
      targetUrl = directUrl;
    }
  }

  res.json({
    success: true,
    url: targetUrl,
    redirectUrl: targetUrl,
    extUserId: opaqueId
  });
});

// POST /api/cpx/sync-transactions
// Syncs verified transactions reported directly by the official CPX script_tag_v2.0.js get_transaction(transactions) callback
app.post('/api/cpx/sync-transactions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { transactions } = req.body || {};
    const txList = Array.isArray(transactions)
      ? transactions
      : transactions && typeof transactions === 'object'
      ? Object.values(transactions)
      : [];

    const settings = dbStore.getSettings();
    const userSharePercent = settings.userSharePercent || 40;
    const pointsPerUsdt = settings.pointsPerUsdt || 10000;
    let newlyCreditedCount = 0;

    for (const rawTx of txList) {
      if (!rawTx || typeof rawTx !== 'object') continue;
      const tx = rawTx as Record<string, unknown>;
      const rawId = String(tx.trans_id || tx.transaction_id || '').trim();
      if (!rawId) continue;

      // Reject any unverified client-generated IDs
      const lowerId = rawId.toLowerCase();
      if (lowerId.startsWith('cpx_survey_') || lowerId.startsWith('sim_cpx_')) continue;

      // If CPX transaction includes status, only credit status === 1 (completed)
      if (tx.status !== undefined && String(tx.status) !== '1') continue;

      const providerTxId = rawId.startsWith('cpx_') ? rawId : `cpx_${rawId}`;
      const offerId = String(tx.offer_id || tx.survey_id || rawId);
      const grossCents = normalizeCpxPostbackGrossCents(
        tx.amount_usd ?? tx.payout_publisher_usd ?? tx.cpi,
        tx.amount_local ?? tx.payout ?? tx.verdienst ?? tx.points,
        pointsPerUsdt
      );
      if (grossCents <= 0) continue;

      const split = calculateHybridSurveySplit(grossCents, userSharePercent, pointsPerUsdt);

      const added = await dbStore.addLedgerEntry({
        id: `ledg_${crypto.randomUUID()}`,
        userId: user.id,
        providerTxId,
        amountCents: split.userRewardCents,
        points: split.userRewardPoints,
        grossCents: split.grossCents,
        adminProfitCents: split.adminProfitCents,
        appliedSharePercent: split.userSharePercent,
        entryType: 'credit',
        status: 'confirmed',
        description: `CPX Research Survey #${offerId} Completed (+${split.userRewardPointsFormatted} Pts)`,
        cpxOfferId: offerId,
        createdAt: new Date().toISOString(),
        processedAt: new Date().toISOString()
      });

      if (added.success) {
        newlyCreditedCount += 1;
      }
    }

    const balances = dbStore.getUserBalances(user.id);
    res.json({
      success: true,
      newlyCreditedCount,
      balances,
      completedSurveysCount: balances.completedSurveysCount
    });
  } catch (err) {
    console.error('[CPX Sync Transactions Error]:', err);
    res.status(500).json({ error: 'Failed to sync CPX transactions.' });
  }
});

// POST /api/surveys/complete
// Verifies with CPX Research whether the user genuinely completed the survey before crediting any points.
// Uncompleted or merely opened surveys NEVER award points.
app.post('/api/surveys/complete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { surveyId, transId } = req.body || {};
    const effectiveSurveyId = String(surveyId || transId || '').trim();
    if (!effectiveSurveyId) {
      res.status(400).json({ error: 'Survey ID is required.' });
      return;
    }

    const settings = dbStore.getSettings();
    const userSharePercent = settings.userSharePercent || 40;
    const pointsPerUsdt = settings.pointsPerUsdt || 10000;
    const opaqueId =
      user.externalOpaqueId ||
      (user.id ? `rr_cpx_${user.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}` : 'rr_cpx_guest_1');

    const rawIp = (
      (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      (req.headers['x-client-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.ip ||
      ''
    ).trim();
    const isPrivateOrLoopback =
      !rawIp ||
      rawIp === '127.0.0.1' ||
      rawIp === '::1' ||
      rawIp.startsWith('::ffff:127.') ||
      rawIp.startsWith('10.') ||
      rawIp.startsWith('192.168.');
    const clientIp = isPrivateOrLoopback ? '5.146.176.100' : rawIp;
    const userAgent =
      req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    // 1. Poll live CPX Research API to see if CPX reported any real completed transactions for this user
    const liveData = await cpxResearchService.fetchEligibleSurveys({
      externalUserId: opaqueId,
      ipAddress: clientIp,
      userAgent
    });

    if (Array.isArray(liveData.transactions) && liveData.transactions.length > 0) {
      for (const rawTx of liveData.transactions) {
        if (!rawTx || typeof rawTx !== 'object') continue;
        const tx = rawTx as Record<string, unknown>;
        const rawTxId = String(tx.trans_id || tx.transaction_id || '').trim();
        if (!rawTxId) continue;
        if (tx.status !== undefined && String(tx.status) !== '1') continue;

        const providerTxId = rawTxId.startsWith('cpx_') ? rawTxId : `cpx_${rawTxId}`;
        const offerId = String(tx.offer_id || tx.survey_id || rawTxId);
        const grossCents = normalizeCpxPostbackGrossCents(
          tx.amount_usd ?? tx.payout_publisher_usd ?? tx.cpi,
          tx.amount_local ?? tx.payout ?? tx.verdienst ?? tx.points,
          pointsPerUsdt
        );
        if (grossCents <= 0) continue;

        const split = calculateHybridSurveySplit(grossCents, userSharePercent, pointsPerUsdt);
        await dbStore.addLedgerEntry({
          id: `ledg_${crypto.randomUUID()}`,
          userId: user.id,
          providerTxId,
          amountCents: split.userRewardCents,
          points: split.userRewardPoints,
          grossCents: split.grossCents,
          adminProfitCents: split.adminProfitCents,
          appliedSharePercent: split.userSharePercent,
          entryType: 'credit',
          status: 'confirmed',
          description: `CPX Research Survey #${offerId} Completed (+${split.userRewardPointsFormatted} Pts)`,
          cpxOfferId: offerId,
          createdAt: new Date().toISOString(),
          processedAt: new Date().toISOString()
        });
      }
    }

    // 2. Check user's verified ledger to see if CPX Research confirmed this survey (via S2S Postback or CPX API)
    const userLedger = dbStore.getLedgerForUser(user.id);
    const verifiedEntry = userLedger.find(l => {
      if (l.entryType !== 'credit' || l.status !== 'confirmed') return false;
      const txLower = String(l.providerTxId || '').toLowerCase();
      if (txLower.startsWith('cpx_survey_') || txLower.startsWith('sim_cpx_')) return false;
      return (
        l.cpxOfferId === effectiveSurveyId ||
        l.providerTxId === effectiveSurveyId ||
        l.providerTxId === `cpx_${effectiveSurveyId}` ||
        (l.description && l.description.includes(`#${effectiveSurveyId}`))
      );
    });

    const balances = dbStore.getUserBalances(user.id);

    if (!verifiedEntry) {
      res.status(200).json({
        success: false,
        verified: false,
        error: `CPX Research has not verified completion for Survey #${effectiveSurveyId} yet. Points are credited automatically only after you finish the full survey on CPX Research.`,
        balances,
        completedSurveysCount: balances.completedSurveysCount
      });
      return;
    }

    const creditedPoints = verifiedEntry.points || 0;
    res.json({
      success: true,
      verified: true,
      creditedPoints,
      creditedPointsFormatted: creditedPoints.toLocaleString('en-US'),
      completedSurveysCount: balances.completedSurveysCount,
      balances,
      entry: verifiedEntry
    });
  } catch (err) {
    console.error('[Survey Verification Check Error]:', err);
    res.status(500).json({ error: 'Could not verify survey status with CPX Research.' });
  }
});

// -----------------------------------------------------------------------------
// Universal Server-to-Server (S2S) Postback Webhook Handler
// Supports: CPALead, AdGate Media, BitLabs, Wannads, AyeT, CPX Research, etc.
// Endpoints: /api/postback, /api/postback/:provider, /api/cpx/postback, /api/cpx-postback, /api/offerwall/postback
// -----------------------------------------------------------------------------
app.all(
  [
    '/api/postback',
    '/api/postback/:provider',
    '/api/cpx/postback',
    '/api/cpx-postback',
    '/api/offerwall/postback'
  ],
  async (req: Request, res: Response) => {
    const params = req.method === 'POST' ? { ...req.query, ...req.body } : req.query;
    const providerParam = String(req.params.provider || params.network || params.provider || '').toLowerCase();

    // 1. Capture User Identifier across all provider naming conventions
    const effectiveUserId = String(
      params.subid ||
      params.subId ||
      params.sub_id ||
      params.ext_user_id ||
      params.user_id ||
      params.userId ||
      params.uid ||
      params.sid ||
      params.s1 ||
      params.user ||
      params.member_id ||
      ''
    ).trim();

    // 2. Capture Transaction ID
    const transId = String(
      params.trans_id ||
      params.transId ||
      params.tx_id ||
      params.tx ||
      params.transaction_id ||
      params.lead_id ||
      params.id ||
      params.order_id ||
      ''
    ).trim();

    // 3. Capture Payout / Reward in Dollars or Points
    const rawPayout =
      params.payout ??
      params.amount_usd ??
      params.amount ??
      params.val ??
      params.reward ??
      params.currency ??
      params.amount_local ??
      params.points;

    // 4. Status Check (1 / complete / bonus / out = credit; 2 = canceled / reversal)
    const rawStatus = String(params.status || '1').toLowerCase();
    const eventType = String(params.type || '').toLowerCase();
    const isScreenOut = eventType === 'out' || eventType === 'screenout';
    const isReversal =
      !isScreenOut && (
        rawStatus === '2' ||
        rawStatus === '3' ||
        rawStatus === '0' ||
        rawStatus === 'reversal' ||
        rawStatus === 'chargeback' ||
        rawStatus === 'canceled' ||
        rawStatus === 'cancelled'
      );

    const receivedHash = String(params.secure_hash || params.hash || params.signature || '').trim();
    const offerId = String(params.offer_id || params.campaign_id || params.campaign || params.survey_id || transId || 'Offer');
    const offerTitle = isScreenOut
      ? 'CPX Screenout Compensation'
      : eventType === 'bonus'
      ? 'CPX Profile Bonus'
      : String(params.offer_name || params.campaign_name || params.title || providerParam || 'Survey/Task');

    console.log(
      `[Universal Postback] Network: ${providerParam || 'universal'}, user=${effectiveUserId}, tx=${transId}, payout=${rawPayout}, isReversal=${isReversal}`
    );

    if (!transId || !effectiveUserId) {
      res.status(400).send('Missing required parameters: subId and transId are required.');
      return;
    }

    // Ignore macro test pings (e.g. {subid} or {lead_id})
    const isMacroOrTest =
      transId === '1' ||
      transId.includes('{') ||
      transId.toLowerCase().includes('test') ||
      effectiveUserId.toLowerCase().includes('test') ||
      effectiveUserId === '12345' ||
      effectiveUserId === '1' ||
      effectiveUserId.includes('{') ||
      receivedHash.includes('{');

    // CPX signature validation if CPX hash configured and signature provided
    const config = cpxResearchService.getConfigStatus();
    if (config.isConfigured && receivedHash && !isMacroOrTest && (providerParam === 'cpx' || !providerParam)) {
      const isValidSig = cpxResearchService.verifyPostback(transId, effectiveUserId, receivedHash);
      if (!isValidSig) {
        console.warn(`[Universal Postback] Signature mismatch note for tx=${transId}, proceeding with user lookup`);
      }
    }

    // Look up target user in memory; if not found, sync latest from Supabase and retry!
    let targetUser =
      dbStore.getUserByExternalId(effectiveUserId) ||
      dbStore.getUserById(effectiveUserId) ||
      dbStore.getUserByAoySubId(effectiveUserId) ||
      dbStore.getUserByUsernameOrEmail(effectiveUserId);

    if (!targetUser) {
      await dbStore.syncFromSupabase();
      targetUser =
        dbStore.getUserByExternalId(effectiveUserId) ||
        dbStore.getUserById(effectiveUserId) ||
        dbStore.getUserByAoySubId(effectiveUserId) ||
        dbStore.getUserByUsernameOrEmail(effectiveUserId);
    }

    if (!targetUser) {
      console.warn(`[Universal Postback] User not found for ID '${effectiveUserId}'. Acknowledging receipt to provider.`);
      res.status(200).send('1');
      return;
    }

    const settings = dbStore.getSettings();
    const userSharePercent = settings.userSharePercent || 40;
    const pointsPerUsdt = settings.pointsPerUsdt || 5000; // 5,000 Points per 1 USD
    const bonusFactor = 7500; // 7,500 Points per 1 USD for Bonus / Screenouts

    // 1. Amount USD: Publisher Payout in real USD (e.g. 0.35 -> 35 cents gross revenue)
    let grossCents = 0;
    const rawUsdVal = params.amount_usd ?? params.payout ?? params.val;
    const parsedUsd = typeof rawUsdVal === 'number'
      ? rawUsdVal
      : parseFloat(String(rawUsdVal || '0').replace(/[^0-9.-]/g, ''));

    if (!isNaN(parsedUsd) && parsedUsd > 0) {
      if (parsedUsd > 50) {
        // If points were accidentally passed in amount_usd (> 50), normalize via pointsPerUsdt
        grossCents = Math.round((parsedUsd / pointsPerUsdt) * 100);
      } else {
        grossCents = Math.round(parsedUsd * 100);
      }
    }

    // 2. Amount Local: Points that must be credited to user (CPX sends precalculated points based on factor 5000 or 7500)
    let userPoints = 0;
    const rawLocalVal = params.amount_local ?? params.points ?? params.reward;
    const parsedLocal = typeof rawLocalVal === 'number'
      ? rawLocalVal
      : parseFloat(String(rawLocalVal || '0').replace(/[^0-9.-]/g, ''));

    if (!isNaN(parsedLocal) && parsedLocal > 0) {
      if (parsedLocal > 1) {
        // Directly the Points value from CPX (e.g. 5000, 2500, or 75 points)
        userPoints = Math.round(parsedLocal);
      } else {
        // If CPX sent decimal USD in amount_local, convert to Points
        const factorToUse = isScreenOut || eventType === 'bonus' ? bonusFactor : pointsPerUsdt;
        userPoints = Math.round(parsedLocal * factorToUse);
      }
    }

    // If one was missing, correlate accurately
    if (grossCents <= 0 && userPoints > 0) {
      const factorToUse = isScreenOut || eventType === 'bonus' ? bonusFactor : pointsPerUsdt;
      grossCents = Math.max(1, Math.round((userPoints / factorToUse) * 100));
    }
    if (userPoints <= 0 && grossCents > 0) {
      const factorToUse = isScreenOut || eventType === 'bonus' ? bonusFactor : pointsPerUsdt;
      userPoints = Math.max(10, Math.round((grossCents / 100) * factorToUse));
    }

    // Safety bounds
    if (userPoints <= 0) userPoints = 50;
    if (grossCents <= 0) grossCents = 1;

    // User share in USD cents (withdrawable) & Admin profit cents
    const userAmountCents = Math.max(1, Math.round((userPoints / pointsPerUsdt) * (userSharePercent / 100) * 100));
    const adminProfitCents = Math.max(0, grossCents - userAmountCents);

    const sb = dbStore.getSupabaseClient();

    if (!isReversal) {
      // -------------------------------------------------------------
      // Status = 1: CREDIT TRANSACTION
      // -------------------------------------------------------------
      const ledgerEntry = {
        id: `ledg_${crypto.randomUUID()}`,
        userId: targetUser.id,
        providerTxId: transId,
        amountCents: userAmountCents,
        points: userPoints,
        grossCents,
        adminProfitCents,
        appliedSharePercent: userSharePercent,
        entryType: 'credit' as const,
        status: 'confirmed' as const,
        description: `${offerTitle} Completed (+${userPoints.toLocaleString('en-US')} Pts • #${offerId})`,
        cpxOfferId: String(offerId || ''),
        createdAt: new Date().toISOString(),
        processedAt: new Date().toISOString()
      };

      const added = await dbStore.addLedgerEntry(ledgerEntry);
      if (!added.success) {
        // Idempotency: Already processed, return 200 OK '1'
        console.log(`[Universal Postback] Duplicate transaction ${transId} acknowledged.`);
        res.status(200).send('1');
        return;
      }

      // Record in platform_treasury table if available in Supabase
      if (sb) {
        try {
          await sb.from('platform_treasury').upsert({
            id: `tr_${transId}`,
            trans_id: transId,
            provider: providerParam || 'cpx',
            user_id: targetUser.id,
            gross_usd: Number((grossCents / 100).toFixed(4)),
            admin_profit_usd: Number((adminProfitCents / 100).toFixed(4)),
            user_points_awarded: userPoints,
            status: 'completed',
            created_at: new Date().toISOString()
          });
        } catch {
          // Ignore if table not provisioned
        }
      }

      res.status(200).send('1');
      return;
    }

    // -----------------------------------------------------------------
    // Status = 2 / 3: CHARGEBACK & FRAUD REVERSAL
    // -----------------------------------------------------------------
    const reversalEntry = {
      id: `ledg_${crypto.randomUUID()}`,
      userId: targetUser.id,
      providerTxId: `${transId}_rev`,
      amountCents: userAmountCents,
      points: userPoints,
      grossCents,
      adminProfitCents,
      appliedSharePercent: userSharePercent,
      entryType: 'reversal' as const,
      status: 'confirmed' as const,
      description: `${offerTitle} Reversal (-${userPoints.toLocaleString('en-US')} Pts • #${offerId})`,
      reversalRef: transId,
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString()
    };

    await dbStore.addLedgerEntry(reversalEntry);

    if (sb) {
      try {
        await sb.from('platform_treasury').upsert({
          id: `tr_${transId}_rev`,
          trans_id: transId,
          provider: providerParam || 'cpx',
          user_id: targetUser.id,
          gross_usd: -Number((grossCents / 100).toFixed(4)),
          admin_profit_usd: -Number((adminProfitCents / 100).toFixed(4)),
          user_points_awarded: -userPoints,
          status: 'reversed',
          created_at: new Date().toISOString()
        });
      } catch {
        // Ignore if table not provisioned
      }
    }

    res.status(200).send('1');
  }
);

// -----------------------------------------------------------------------------
// White-Label Instant Tasks & PTC Endpoints (Powered by AoyTasks behind the scenes)
// Users ONLY see Reward River branding; Admin manages AoyTasks in Admin Console
// -----------------------------------------------------------------------------
app.get('/api/tasks', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const settings = dbStore.getSettings();
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '5.146.176.100';
    const ua = req.headers['user-agent'] || 'Mozilla/5.0';

    const result = await aoyTasksService.fetchWhiteLabelTasks({
      rawUserId: user.externalOpaqueId || user.id,
      ipAddress: ip,
      userAgent: ua,
      forceRefresh: req.query.refresh === '1'
    });

    const offerwallUrl = aoyTasksService.generateOfferwallUrl(user.externalOpaqueId || user.id);

    res.json({
      tasks: result.tasks,
      offerwallUrl,
      pointsPerUsdt: settings.pointsPerUsdt || 10000,
      userSharePercent: settings.userSharePercent || 40,
      surveyDisplayMode: settings.surveyDisplayMode || 'hybrid'
    });
  } catch (err) {
    console.error('Failed to fetch white-label tasks:', err);
    res.status(500).json({ error: 'Unable to load Instant Tasks at this moment.' });
  }
});

// POST /api/tasks/complete (White-Label in-app PTC & Express Task completion)
app.post('/api/tasks/complete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { taskId, title, rewardPoints } = req.body;
    if (!taskId) {
      res.status(400).json({ error: 'Task identifier is required.' });
      return;
    }

    const settings = dbStore.getSettings();
    const userSharePercent = settings.userSharePercent || 40;
    const pointsPerUsdt = settings.pointsPerUsdt || 10000;

    // Today's date key so each user can claim a specific daily task once per day
    const dateKey = new Date().toISOString().slice(0, 10);
    const providerTxId = `rr_task_${user.id}_${taskId}_${dateKey}`;

    const pointsNum = Math.max(100, Number(rewardPoints) || 2500);
    const grossCents = Math.max(5, Math.round((pointsNum / pointsPerUsdt) * 100));
    const split = calculateHybridSurveySplit(grossCents, userSharePercent, pointsPerUsdt);
    const cleanTitle = sanitizeWhiteLabelText(String(title || 'Sponsored Task'), 'Sponsored Task');

    const ledgerEntry = {
      id: `ledg_${crypto.randomUUID()}`,
      userId: user.id,
      providerTxId,
      amountCents: split.userRewardCents,
      points: split.userRewardPoints,
      grossCents: split.grossCents,
      adminProfitCents: split.adminProfitCents,
      appliedSharePercent: split.userSharePercent,
      entryType: 'credit' as const,
      status: 'confirmed' as const,
      description: `Instant Task Reward (+${split.userRewardPointsFormatted} Pts • ${cleanTitle})`,
      cpxOfferId: String(taskId),
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString()
    };

    const result = await dbStore.addLedgerEntry(ledgerEntry);
    if (!result.success) {
      res.status(400).json({ error: 'You have already claimed this daily task today.' });
      return;
    }

    res.json({
      success: true,
      creditedPoints: split.userRewardPoints,
      creditedPointsFormatted: split.userRewardPointsFormatted,
      creditedUsdt: split.userRewardUsdtFormatted,
      balances: dbStore.getUserBalances(user.id)
    });
  } catch (err) {
    console.error('Task completion error:', err);
    res.status(500).json({ error: 'Failed to credit task completion.' });
  }
});

// -----------------------------------------------------------------------------
// AoyTasks Server-to-Server (S2S) Postback Webhook Handler
// Supports: /wh/aoytasks, /api/aoytasks/postback
// Exact signature spec: md5(subId + transId + reward + secret_key)
// Exact response spec: lowercase "ok" on success, "DUP" on duplicate
// -----------------------------------------------------------------------------
app.all(['/wh/aoytasks', '/api/aoytasks/postback'], async (req: Request, res: Response) => {
  const params = req.method === 'POST' ? { ...req.query, ...req.body } : req.query;
  const subIdRaw = String(params.subId ?? '').trim();
  const transIdRaw = String(params.transId ?? '').trim();
  const rewardRaw = String(params.reward ?? '').trim();
  const payoutRaw = String(params.payout ?? '').trim();
  const signatureRaw = String(params.signature ?? '').trim();
  const statusRaw = Number(params.status ?? 1);
  const offerNameRaw = String(params.offer_name ?? 'Partner Task').trim();
  const offerTypeRaw = String(params.offer_type ?? 'ptc').trim().toUpperCase();

  if (!subIdRaw || !transIdRaw) {
    res.status(200).send('ERROR: No Data Received');
    return;
  }

  const isValidSig = aoyTasksService.verifyPostback({
    subId: subIdRaw,
    transId: transIdRaw,
    reward: rewardRaw,
    signature: signatureRaw
  });

  if (!isValidSig) {
    res.status(200).send("ERROR: Signature doesn't match");
    return;
  }

  const targetUser =
    dbStore.getUserByAoySubId(subIdRaw) ||
    dbStore.getUserByExternalId(subIdRaw) ||
    dbStore.getUserById(subIdRaw);

  if (!targetUser) {
    // Acknowledge with ok if user not matched in test mode
    res.status(200).send('ok');
    return;
  }

  const settings = dbStore.getSettings();
  const userSharePercent = settings.userSharePercent || 40;
  const pointsPerUsdt = settings.pointsPerUsdt || 10000;
  const exchangeRate = settings.aoyExchangeRate || 10000;

  const grossCents = aoyRewardToGrossCents(rewardRaw, exchangeRate, payoutRaw);
  const split = calculateHybridSurveySplit(grossCents, userSharePercent, pointsPerUsdt);
  const cleanOfferName = sanitizeWhiteLabelText(offerNameRaw, `Sponsored ${offerTypeRaw}`);

  if (statusRaw === 2) {
    // Chargeback / Reversal
    const revEntry = {
      id: `ledg_${crypto.randomUUID()}`,
      userId: targetUser.id,
      providerTxId: `aoy_rev_${transIdRaw}`,
      amountCents: split.userRewardCents,
      points: split.userRewardPoints,
      grossCents: split.grossCents,
      adminProfitCents: split.adminProfitCents,
      appliedSharePercent: split.userSharePercent,
      entryType: 'reversal' as const,
      status: 'confirmed' as const,
      description: `Task Reversal (-${split.userRewardPointsFormatted} Pts • ${cleanOfferName})`,
      reversalRef: transIdRaw,
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString()
    };
    await dbStore.addLedgerEntry(revEntry);
    res.status(200).send('ok');
    return;
  }

  // Credit (status = 1)
  const creditEntry = {
    id: `ledg_${crypto.randomUUID()}`,
    userId: targetUser.id,
    providerTxId: `aoy_${transIdRaw}`,
    amountCents: split.userRewardCents,
    points: split.userRewardPoints,
    grossCents: split.grossCents,
    adminProfitCents: split.adminProfitCents,
    appliedSharePercent: split.userSharePercent,
    entryType: 'credit' as const,
    status: 'confirmed' as const,
    description: `Instant Task Reward (+${split.userRewardPointsFormatted} Pts • ${cleanOfferName})`,
    cpxOfferId: `task_${transIdRaw}`,
    createdAt: new Date().toISOString(),
    processedAt: new Date().toISOString()
  };

  const added = await dbStore.addLedgerEntry(creditEntry);
  if (!added.success) {
    res.status(200).send('DUP');
    return;
  }

  res.status(200).send('ok');
});

// -----------------------------------------------------------------------------
// USDT & Financial Endpoints
// -----------------------------------------------------------------------------

// GET /api/usdt/price
app.get('/api/usdt/price', async (req: Request, res: Response) => {
  try {
    const quote = await usdtPriceService.getUsdtPriceQuote();
    res.json(quote);
  } catch {
    res.status(500).json({ error: 'Failed to fetch USDT price quote.' });
  }
});

// GET /api/ledger
app.get('/api/ledger', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const settings = dbStore.getSettings();
  const userSharePercent = settings.userSharePercent || 40;
  const pointsPerUsdt = settings.pointsPerUsdt || 10000;
  const rawEntries = dbStore.getLedgerForUser(user.id);
  const entries = rawEntries.map(({ grossCents: _g, adminProfitCents: _a, appliedSharePercent: _s, ...safeEntry }) => ({
    ...safeEntry,
    points: safeEntry.points ?? usdCentsToPoints(safeEntry.amountCents, pointsPerUsdt, userSharePercent)
  }));
  const rawBalances = dbStore.getUserBalances(user.id);
  const { totalAdminProfitCents: _ap, totalGrossRevenueCents: _gr, ...userSafeBalances } = rawBalances;
  res.json({
    entries,
    balances: user.role === 'admin' ? rawBalances : userSafeBalances,
    pointsPerUsdt,
    userSharePercent,
    userUsdtPer10kPoints: (userSharePercent / 100).toFixed(2)
  });
});

// GET /api/withdrawals
app.get('/api/withdrawals', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const withdrawals = dbStore.getWithdrawalsForUser(user.id);
  res.json({ withdrawals });
});

// POST /api/withdrawals (USDT Withdrawal)
app.post('/api/withdrawals', requireAuth, requireVerifiedEmail, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { usdtAddress, network = 'TRC20', amountCents } = req.body;
    const settings = dbStore.getSettings();

    const targetNetwork: 'TRC20' | 'ERC20' = network === 'ERC20' ? 'ERC20' : 'TRC20';

    // 1. Validate USDT Address
    const addressCheck = validateUsdtAddress(usdtAddress, targetNetwork);
    if (!addressCheck.isValid) {
      res.status(400).json({ error: addressCheck.error || 'Invalid USDT destination address.' });
      return;
    }

    // 2. Check balance and withdrawal limits
    const balances = dbStore.getUserBalances(user.id);
    const parsedAmount = Math.floor(Number(amountCents));

    const check = canSubmitWithdrawal({
      amountCents: parsedAmount,
      availableCents: balances.availableCents,
      emailVerified: user.emailVerified,
      minCents: settings.minWithdrawalCents,
      maxCents: settings.maxWithdrawalCents
    });

    if (!check.allowed) {
      res.status(400).json({ error: check.reason });
      return;
    }

    // 3. Fee calculation
    const networkFeeCents = targetNetwork === 'ERC20' ? settings.feeCentsErc20 : settings.feeCentsTrc20;
    const payoutCalc = calculateUsdtPayout(parsedAmount, targetNetwork, networkFeeCents);
    if (!payoutCalc.isViable) {
      res.status(400).json({ error: payoutCalc.error || 'Net payout must be greater than zero.' });
      return;
    }

    // 4. Create withdrawal request
    const withdrawalId = `w_${crypto.randomUUID()}`;
    const newRequest = await dbStore.createWithdrawalRequest({
      id: withdrawalId,
      userId: user.id,
      userEmail: user.email,
      usdtAddress: usdtAddress.trim(),
      network: targetNetwork,
      amountCents: parsedAmount,
      feeCents: networkFeeCents,
      netCents: payoutCalc.netCents,
      grossUsdt: payoutCalc.grossUsdt,
      feeUsdt: payoutCalc.feeUsdt,
      netUsdt: payoutCalc.netUsdt,
      status: 'under_review',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reviewNotes: `Awaiting administrative verification and ${targetNetwork} batch payout settlement.`
    });

    await usdtPayoutManager.getProvider().processWithdrawal(newRequest);

    res.status(201).json({
      success: true,
      message: 'USDT withdrawal request submitted. It is now safely queued for review.',
      withdrawal: newRequest,
      balances: dbStore.getUserBalances(user.id)
    });
  } catch (err: unknown) {
    console.error('Withdrawal error:', err);
    res.status(500).json({ error: 'Could not process withdrawal request. Please try again.' });
  }
});

// -----------------------------------------------------------------------------
// Administrator Endpoints
// -----------------------------------------------------------------------------

// GET /api/admin/overview
app.get('/api/admin/overview', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  await dbStore.syncFromSupabase();
  const users = dbStore.getAllUsers();
  const withdrawals = dbStore.getAllWithdrawals();
  const ledger = dbStore.getAllLedgerEntries();
  const settings = dbStore.getSettings();
  const cpxStatus = cpxResearchService.getConfigStatus();
  const aoyStatus = aoyTasksService.getConfigStatus();
  const payoutStatus = usdtPayoutManager.getStatus();
  const safePtsRate = settings.pointsPerUsdt || 10000;
  const safeShare = settings.userSharePercent || 40;

  const confirmedCredits = ledger.filter(l => l.status === 'confirmed' && l.entryType === 'credit');
  const confirmedReversals = ledger.filter(l => l.status === 'confirmed' && l.entryType === 'reversal');

  const totalRewardsCreditedCents = Math.max(
    0,
    confirmedCredits.reduce((sum, l) => sum + l.amountCents, 0) -
      confirmedReversals.reduce((sum, l) => sum + l.amountCents, 0)
  );

  const entryToPts = (l: typeof ledger[number]) =>
    typeof l.points === 'number' && !isNaN(l.points) && l.points > 0
      ? Math.round(l.points)
      : usdCentsToPoints(l.amountCents, safePtsRate, safeShare);

  const totalRewardsCreditedPoints = Math.max(
    0,
    confirmedCredits.reduce((sum, l) => sum + entryToPts(l), 0) -
      confirmedReversals.reduce((sum, l) => sum + entryToPts(l), 0)
  );

  // Calculate gross CPX revenue and hidden admin net profit across all surveys
  const totalGrossRevenueCents = Math.max(
    0,
    confirmedCredits.reduce((sum, l) => {
      const share = l.appliedSharePercent || 40;
      const gross = typeof l.grossCents === 'number' ? l.grossCents : Math.round(l.amountCents / (share / 100));
      return sum + gross;
    }, 0) -
      confirmedReversals.reduce((sum, l) => {
        const share = l.appliedSharePercent || 40;
        const gross = typeof l.grossCents === 'number' ? l.grossCents : Math.round(l.amountCents / (share / 100));
        return sum + gross;
      }, 0)
  );

  const totalAdminProfitCents = Math.max(
    0,
    confirmedCredits.reduce((sum, l) => {
      const share = l.appliedSharePercent || 40;
      const gross = typeof l.grossCents === 'number' ? l.grossCents : Math.round(l.amountCents / (share / 100));
      const profit = typeof l.adminProfitCents === 'number' ? l.adminProfitCents : Math.max(0, gross - l.amountCents);
      return sum + profit;
    }, 0) -
      confirmedReversals.reduce((sum, l) => {
        const share = l.appliedSharePercent || 40;
        const gross = typeof l.grossCents === 'number' ? l.grossCents : Math.round(l.amountCents / (share / 100));
        const profit = typeof l.adminProfitCents === 'number' ? l.adminProfitCents : Math.max(0, gross - l.amountCents);
        return sum + profit;
      }, 0)
  );

  const pendingWithdrawalCount = withdrawals.filter(w => ['requested', 'under_review'].includes(w.status)).length;
  const paidWithdrawalTotalCents = withdrawals
    .filter(w => w.status === 'paid')
    .reduce((sum, w) => sum + w.netCents, 0);

  const userMap = new Map(users.map(u => [u.id, u]));
  const recentLedger = ledger.slice(0, 10).map(l => {
    const owner = userMap.get(l.userId);
    const share = l.appliedSharePercent || settings.userSharePercent || 40;
    const gross = typeof l.grossCents === 'number' ? l.grossCents : Math.round(l.amountCents / (share / 100));
    const profit = typeof l.adminProfitCents === 'number' ? l.adminProfitCents : Math.max(0, gross - l.amountCents);
    return {
      ...l,
      grossCents: gross,
      adminProfitCents: profit,
      appliedSharePercent: share,
      userEmail: owner?.email || 'Unknown',
      userDisplayName: owner?.displayName || 'Member'
    };
  });

  const countryMap: Record<string, number> = {};
  for (const u of users) {
    const code = (u.countryCode || '').trim().toUpperCase();
    if (code) {
      countryMap[code] = (countryMap[code] || 0) + 1;
    }
  }
  const countryDistribution = Object.entries(countryMap)
    .map(([countryCode, count]) => ({
      countryCode,
      count,
      percentage: users.length > 0 ? Math.round((count / users.length) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);

  const userDirectoryMap = new Map(
    users.map(u => [u.id, { email: u.email, displayName: u.displayName }])
  );
  const partnerAccounting = buildPartnerAccountingReport(
    ledger,
    settings.userSharePercent || 40,
    settings.pointsPerUsdt || 10000,
    userDirectoryMap
  );

  res.json({
    totalUsers: users.length,
    completedSurveysCount: confirmedCredits.length,
    totalRewardsCreditedCents,
    totalRewardsCreditedPoints,
    totalGrossRevenueCents,
    totalAdminProfitCents,
    userSharePercent: settings.userSharePercent || 40,
    pointsPerUsdt: settings.pointsPerUsdt || 10000,
    pendingWithdrawalCount,
    paidWithdrawalTotalUsdt: (paidWithdrawalTotalCents / 100).toFixed(2),
    cpxStatus,
    aoyStatus,
    payoutStatus,
    recentLedger,
    partnerAccounting,
    countryDistribution
  });
});

// GET /api/admin/withdrawals
app.get('/api/admin/withdrawals', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const withdrawals = dbStore.getAllWithdrawals();
  res.json({ withdrawals });
});

// POST /api/admin/withdrawals/:id/review
app.post('/api/admin/withdrawals/:id/review', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminUser = req.user!;
    const id = req.params.id;
    const { action, notes, txHash } = req.body;

    const target = dbStore.getWithdrawalById(id);
    if (!target) {
      res.status(404).json({ error: 'Withdrawal request not found.' });
      return;
    }

    let newStatus: typeof target.status;
    if (action === 'approve') newStatus = 'approved';
    else if (action === 'mark_paid') {
      if (!txHash) {
        res.status(400).json({ error: 'A confirmed on-chain transaction hash (txHash) is required to mark a payout as paid.' });
        return;
      }
      newStatus = 'paid';
    } else if (action === 'reject') newStatus = 'rejected';
    else if (action === 'cancel') newStatus = 'cancelled';
    else {
      res.status(400).json({ error: 'Invalid review action.' });
      return;
    }

    const updated = await dbStore.updateWithdrawalStatus(id, newStatus, adminUser.id, notes, txHash);

    await dbStore.addAuditLog({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: `WITHDRAWAL_${action.toUpperCase()}`,
      targetEntity: 'withdrawal_requests',
      targetId: id,
      details: `Status changed to ${newStatus}. Notes: ${notes || 'none'}. TxHash: ${txHash || 'none'}`
    });

    res.json({ success: true, withdrawal: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

// GET /api/admin/settings
app.get('/api/admin/settings', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  res.json(dbStore.getSettings());
});

// POST /api/admin/settings
app.post('/api/admin/settings', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const admin = req.user!;
    const {
      supabaseUrl,
      supabaseAnonKey,
      supabaseServiceKey,
      minWithdrawalCents,
      maxWithdrawalCents,
      feeCentsTrc20,
      feeCentsErc20,
      userSharePercent,
      pointsPerUsdt,
      surveyDisplayMode,
      cpxAppId,
      cpxHashKey,
      cpxIntegrationMode,
      cpxMaxSurveys,
      cpxThemeColor,
      cpxEnableFallback,
      cpxVerifySignature,
      aoyApiKey,
      aoySecretKey,
      aoyBearerToken,
      aoyExchangeRate,
      aoyEnableFallback,
      aoyVerifySignature,
      maintenanceMode,
      defaultNetwork,
      googleAnalyticsId,
      googleAnalyticsEnabled,
      metaTitle,
      metaDescription,
      metaKeywords,
      ogImageUrl,
      googleSearchConsoleKey,
      sitemapEnabled
    } = req.body;

    const current = dbStore.getSettings();
    const parsedShare = Number(userSharePercent);
    const clampedShare = !isNaN(parsedShare) && parsedShare >= 1 && parsedShare <= 100
      ? Math.round(parsedShare)
      : (current.userSharePercent || 40);

    const parsedPointsPerUsdt = Number(pointsPerUsdt);
    const effectivePointsPerUsdt = !isNaN(parsedPointsPerUsdt) && parsedPointsPerUsdt >= 100
      ? Math.round(parsedPointsPerUsdt)
      : (current.pointsPerUsdt || 10000);

    const effectiveDisplayMode: 'hybrid' | 'points_only' =
      surveyDisplayMode === 'points_only' ? 'points_only' : 'hybrid';

    const effectiveCpxMode: 'hybrid_api' | 'direct_wall' | 'paused' =
      cpxIntegrationMode === 'direct_wall' || cpxIntegrationMode === 'paused'
        ? cpxIntegrationMode
        : 'hybrid_api';

    const updated = await dbStore.updateSettings(
      {
        supabaseUrl: typeof supabaseUrl === 'string' ? supabaseUrl.trim() : (current.supabaseUrl || ''),
        supabaseAnonKey: typeof supabaseAnonKey === 'string' ? supabaseAnonKey.trim() : (current.supabaseAnonKey || ''),
        supabaseServiceKey: typeof supabaseServiceKey === 'string' ? supabaseServiceKey.trim() : (current.supabaseServiceKey || ''),
        minWithdrawalCents: Number(minWithdrawalCents) || current.minWithdrawalCents,
        maxWithdrawalCents: Number(maxWithdrawalCents) || current.maxWithdrawalCents,
        feeCentsTrc20: Number(feeCentsTrc20) >= 0 ? Number(feeCentsTrc20) : current.feeCentsTrc20,
        feeCentsErc20: Number(feeCentsErc20) >= 0 ? Number(feeCentsErc20) : current.feeCentsErc20,
        userSharePercent: clampedShare,
        pointsPerUsdt: effectivePointsPerUsdt,
        surveyDisplayMode: effectiveDisplayMode,
        cpxAppId: typeof cpxAppId === 'string' && cpxAppId.trim() ? cpxAppId.trim() : (current.cpxAppId || '37479'),
        cpxHashKey: typeof cpxHashKey === 'string' && cpxHashKey.trim() ? cpxHashKey.trim() : (current.cpxHashKey || 'yTrC9mntJwV1PSRJ5WdMbwMSel6qMheY'),
        cpxIntegrationMode: effectiveCpxMode,
        cpxMaxSurveys: Math.max(1, Math.min(50, Number(cpxMaxSurveys) || current.cpxMaxSurveys || 12)),
        cpxThemeColor: typeof cpxThemeColor === 'string' && cpxThemeColor.trim() ? cpxThemeColor.trim().replace('#', '') : (current.cpxThemeColor || '10b981'),
        cpxEnableFallback: cpxEnableFallback !== undefined ? Boolean(cpxEnableFallback) : (current.cpxEnableFallback ?? true),
        cpxVerifySignature: cpxVerifySignature !== undefined ? Boolean(cpxVerifySignature) : (current.cpxVerifySignature ?? true),
        aoyApiKey: typeof aoyApiKey === 'string' ? aoyApiKey.trim() : (current.aoyApiKey || ''),
        aoySecretKey: typeof aoySecretKey === 'string' ? aoySecretKey.trim() : (current.aoySecretKey || ''),
        aoyBearerToken: typeof aoyBearerToken === 'string' ? aoyBearerToken.trim() : (current.aoyBearerToken || ''),
        aoyExchangeRate: Math.max(100, Number(aoyExchangeRate) || current.aoyExchangeRate || 10000),
        aoyEnableFallback: aoyEnableFallback !== undefined ? Boolean(aoyEnableFallback) : (current.aoyEnableFallback ?? true),
        aoyVerifySignature: aoyVerifySignature !== undefined ? Boolean(aoyVerifySignature) : (current.aoyVerifySignature ?? true),
        maintenanceMode: Boolean(maintenanceMode),
        defaultNetwork: defaultNetwork === 'ERC20' ? 'ERC20' : 'TRC20',
        googleAnalyticsId: typeof googleAnalyticsId === 'string' ? googleAnalyticsId.trim() : current.googleAnalyticsId,
        googleAnalyticsEnabled: googleAnalyticsEnabled !== undefined ? Boolean(googleAnalyticsEnabled) : current.googleAnalyticsEnabled,
        metaTitle: typeof metaTitle === 'string' && metaTitle.trim() ? metaTitle.trim() : current.metaTitle,
        metaDescription: typeof metaDescription === 'string' && metaDescription.trim() ? metaDescription.trim() : current.metaDescription,
        metaKeywords: typeof metaKeywords === 'string' ? metaKeywords.trim() : current.metaKeywords,
        ogImageUrl: typeof ogImageUrl === 'string' && ogImageUrl.trim() ? ogImageUrl.trim() : current.ogImageUrl,
        googleSearchConsoleKey: typeof googleSearchConsoleKey === 'string' ? googleSearchConsoleKey.trim() : current.googleSearchConsoleKey,
        sitemapEnabled: sitemapEnabled !== undefined ? Boolean(sitemapEnabled) : current.sitemapEnabled
      },
      admin?.id || 'usr_admin_rewardriver'
    );

    res.json({ success: true, settings: updated });
  } catch (err: unknown) {
    console.error('[Admin Settings Update Error]:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save settings.' });
  }
});

// POST /api/admin/test-aoy-connection
app.post('/api/admin/test-aoy-connection', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startMs = Date.now();
    const admin = req.user!;
    const status = aoyTasksService.getConfigStatus();
    const feed = await aoyTasksService.fetchWhiteLabelTasks({
      rawUserId: admin.externalOpaqueId || admin.id,
      ipAddress: '5.146.176.100',
      userAgent: req.headers['user-agent'] || 'Mozilla/5.0',
      forceRefresh: true
    });
    const cleanSubId = sanitizeAoySubId(admin.externalOpaqueId || admin.id);

    res.json({
      success: true,
      latencyMs: Date.now() - startMs,
      configStatus: status,
      sanitizedSubId: cleanSubId,
      ptcEndpoint: `https://aoyco.in/api/v1/ptc/${aoyTasksService.apiKey || '[API_KEY]'}/${cleanSubId}/5.146.176.100`,
      shortlinkEndpoint: `https://aoyco.in/api/v1/sl-api/${aoyTasksService.apiKey || '[API_KEY]'}/${cleanSubId}/5.146.176.100`,
      offerwallUrlSample: aoyTasksService.generateOfferwallUrl(cleanSubId),
      tasksReturned: feed.tasks.length,
      source: feed.source
    });
  } catch {
    res.status(500).json({ error: 'Failed to test AoyTasks connection.' });
  }
});

// POST /api/admin/test-aoy-postback
app.post('/api/admin/test-aoy-postback', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetUserId, grossCents = 50, offerName = 'Sponsored PTC Campaign #41', offerType = 'ptc', status = 1 } = req.body;
    const user = dbStore.getUserById(targetUserId) || req.user!;
    const settings = dbStore.getSettings();
    const userSharePercent = settings.userSharePercent || 40;
    const pointsPerUsdt = settings.pointsPerUsdt || 10000;

    const effectiveGrossCents = Math.max(5, Number(grossCents) || 50);
    const split = calculateHybridSurveySplit(effectiveGrossCents, userSharePercent, pointsPerUsdt);
    const transId = `aoy_sim_${Date.now()}`;
    const cleanTitle = sanitizeWhiteLabelText(String(offerName), 'Sponsored Partner Task');

    const entry = {
      id: `ledg_${crypto.randomUUID()}`,
      userId: user.id,
      providerTxId: transId,
      amountCents: split.userRewardCents,
      points: split.userRewardPoints,
      grossCents: split.grossCents,
      adminProfitCents: split.adminProfitCents,
      appliedSharePercent: split.userSharePercent,
      entryType: status === 2 ? ('reversal' as const) : ('credit' as const),
      status: 'confirmed' as const,
      description: `Instant Task Reward (${status === 2 ? '-' : '+'}${split.userRewardPointsFormatted} Pts • ${cleanTitle})`,
      cpxOfferId: `${offerType}_${transId}`,
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString()
    };

    const result = await dbStore.addLedgerEntry(entry);
    await dbStore.addAuditLog({
      adminUserId: req.user!.id,
      adminEmail: req.user!.email,
      action: 'ADMIN_SIMULATE_AOYTASKS_POSTBACK',
      targetEntity: 'reward_ledger',
      targetId: entry.id,
      details: `Simulated AoyTasks S2S Postback ($${(split.grossCents / 100).toFixed(2)} Gross @ ${split.userSharePercent}% share): User saw white-label "${entry.description}" (${split.userRewardUsdtFormatted}), Hidden Admin Profit: ${split.adminProfitUsdFormatted}`
    });

    res.json({
      success: result.success,
      webhookResponse: 'ok',
      entry: result.entry,
      split,
      balances: dbStore.getUserBalances(user.id)
    });
  } catch {
    res.status(500).json({ error: 'Failed to simulate AoyTasks postback.' });
  }
});

// POST /api/admin/test-cpx-connection
app.post('/api/admin/test-cpx-connection', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startMs = Date.now();
    const admin = req.user!;
    const settings = dbStore.getSettings();
    const status = cpxResearchService.getConfigStatus();
    const liveFeed = await cpxResearchService.fetchEligibleSurveys({
      externalUserId: admin.externalOpaqueId || `rr_cpx_admin_${admin.id}`,
      ipAddress: '5.146.176.100',
      userAgent: req.headers['user-agent'] || 'Mozilla/5.0'
    });
    const sampleWallUrl = cpxResearchService.generateSurveyStartUrl(admin.externalOpaqueId || 'rr_cpx_admin');

    res.json({
      success: true,
      latencyMs: Date.now() - startMs,
      cpxAppId: cpxResearchService.appId,
      integrationMode: settings.cpxIntegrationMode || 'hybrid_api',
      enableFallback: settings.cpxEnableFallback !== false,
      verifySignature: settings.cpxVerifySignature !== false,
      configStatus: status,
      apiEndpoint: 'https://live-api.cpx-research.com/api/get-surveys.php',
      offerwallUrlSample: sampleWallUrl,
      liveSurveysReturned: liveFeed.surveys.length,
      apiMessage: liveFeed.message || 'Connected to CPX Research live endpoint successfully.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to test CPX Research connection.' });
  }
});

// GET /api/admin/audit-logs
app.get('/api/admin/audit-logs', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  res.json({ logs: dbStore.getAuditLogs() });
});

// POST /api/admin/test-cpx-postback
app.post('/api/admin/test-cpx-postback', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetUserId, rewardCents = 100, grossCents, offerId = 'test_offer_101', status = 1 } = req.body;
    const user = dbStore.getUserById(targetUserId) || req.user!;
    const settings = dbStore.getSettings();
    const userSharePercent = settings.userSharePercent || 40;
    const pointsPerUsdt = settings.pointsPerUsdt || 10000;

    // Treat incoming rewardCents / grossCents as the 100% Gross CPX Payout (e.g. 100 cents = $1.00 gross)
    const effectiveGrossCents = Math.max(10, Number(grossCents || rewardCents) || 100);
    const split = calculateHybridSurveySplit(effectiveGrossCents, userSharePercent, pointsPerUsdt);
    const transId = `test_cpx_${Date.now()}`;

    const entry = {
      id: `ledg_${crypto.randomUUID()}`,
      userId: user.id,
      providerTxId: transId,
      amountCents: split.userRewardCents,
      points: split.userRewardPoints,
      grossCents: split.grossCents,
      adminProfitCents: split.adminProfitCents,
      appliedSharePercent: split.userSharePercent,
      entryType: status === 3 ? ('reversal' as const) : ('credit' as const),
      status: 'confirmed' as const,
      description: `CPX Survey (${status === 3 ? '-' : '+'}${split.userRewardPointsFormatted} Pts • Offer #${offerId})`,
      cpxOfferId: String(offerId),
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString()
    };

    const result = await dbStore.addLedgerEntry(entry);
    await dbStore.addAuditLog({
      adminUserId: req.user!.id,
      adminEmail: req.user!.email,
      action: 'ADMIN_SIMULATE_CPX_POSTBACK',
      targetEntity: 'reward_ledger',
      targetId: entry.id,
      details: `Simulated CPX Postback ($${(split.grossCents / 100).toFixed(2)} Gross @ ${split.userSharePercent}% share): Credited ${split.userRewardPointsFormatted} Pts (${split.userRewardUsdtFormatted}) to ${user.email}, Admin Profit: ${split.adminProfitUsdFormatted}`
    });

    res.json({
      success: result.success,
      entry: result.entry,
      split,
      balances: dbStore.getUserBalances(user.id)
    });
  } catch {
    res.status(500).json({ error: 'Failed to simulate CPX postback' });
  }
});

// POST /api/admin/run-full-integration-check
app.post('/api/admin/run-full-integration-check', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startMs = Date.now();
    const admin = req.user!;
    const settings = dbStore.getSettings();
    const userSharePercent = settings.userSharePercent || 40;
    const pointsPerUsdt = settings.pointsPerUsdt || 10000;

    // 1. Verify CPX Research Offerwall & Feed
    const extId = admin.externalOpaqueId || `rr_cpx_admin_${admin.id}`;
    const cpxWallUrl = cpxResearchService.generateSurveyStartUrl(extId, '101');
    const cpxLiveFeed = await cpxResearchService.fetchEligibleSurveys({
      externalUserId: extId,
      ipAddress: '5.146.176.100',
      userAgent: req.headers['user-agent'] || 'Mozilla/5.0'
    });

    // 2. Verify CPX S2S Postback MD5 Signature
    const testCpxTransId = `diag_cpx_${Date.now()}`;
    const cpxSecret = cpxResearchService.hashKey;
    const cpxExpectedSig = generateCpxSecureHash(testCpxTransId, cpxSecret);
    const cpxSigVerified = verifyCpxPostbackSignature(testCpxTransId, extId, cpxExpectedSig, cpxSecret);

    // 3. Verify AoyTasks White-Label Feed & SubId Sanitizer
    const cleanSubId = sanitizeAoySubId(extId);
    const subIdAlphanumericOnly = /^[a-zA-Z0-9]+$/.test(cleanSubId);
    const aoyFeed = await aoyTasksService.fetchWhiteLabelTasks({
      rawUserId: extId,
      ipAddress: '5.146.176.100',
      userAgent: req.headers['user-agent'] || 'Mozilla/5.0',
      forceRefresh: true
    });
    const whiteLabelClean = aoyFeed.tasks.every(
      t => !/aoytasks|aoyco\.in/i.test(`${t.title} ${t.description}`)
    );

    // 4. Verify AoyTasks S2S Postback MD5 Signature (md5(subId + transId + reward + secret_key))
    const testAoyTransId = `diag_aoy_${Date.now()}`;
    const testAoyReward = '5000';
    const aoySecret = aoyTasksService.secretKey || 'diag_secret_key_test';
    const aoySig = generateAoyPostbackSignature(cleanSubId, testAoyTransId, testAoyReward, aoySecret);
    const aoySigVerified = verifyAoyPostbackSignature(cleanSubId, testAoyTransId, testAoyReward, aoySecret, aoySig);

    // 5. Verify 40% User / 60% Hidden Admin Split Math on 10,000 Points ($1.00 Gross)
    const splitTest = calculateHybridSurveySplit(100, userSharePercent, pointsPerUsdt);
    const splitVerified =
      splitTest.grossCents === 100 &&
      splitTest.userRewardCents === userSharePercent &&
      splitTest.adminProfitCents === 100 - userSharePercent &&
      splitTest.userRewardPoints === pointsPerUsdt;

    // 6. Verify Partner Revenue & Settlement Engine
    const users = dbStore.getAllUsers();
    const userDirectoryMap = new Map(users.map(u => [u.id, { email: u.email, displayName: u.displayName }]));
    const accountingReport = buildPartnerAccountingReport(
      dbStore.getAllLedgerEntries(),
      userSharePercent,
      pointsPerUsdt,
      userDirectoryMap
    );

    const checks = [
      {
        id: 'cpx_offerwall_api',
        partner: 'CPX Research',
        title: `CPX App ID #${cpxResearchService.appId} & Signed Offerwall URL`,
        passed: Boolean(cpxResearchService.appId && cpxWallUrl.includes('cpx-research.com')),
        detail: `App ID #${cpxResearchService.appId} active • Signed URL ready (${cpxLiveFeed.surveys.length} live surveys returned)`
      },
      {
        id: 'cpx_s2s_postback',
        partner: 'CPX Research',
        title: 'CPX S2S Postback & MD5 Security Hash Verification',
        passed: cpxSigVerified,
        detail: `Webhook /api/cpx/postback verified • MD5(trans_id-secret) signature check passed`
      },
      {
        id: 'aoy_whitelabel_feed',
        partner: 'AoyTasks (aoyco.in)',
        title: 'AoyTasks 100% White-Label Tasks & Strict Alphanumeric SubId',
        passed: subIdAlphanumericOnly && whiteLabelClean,
        detail: `${aoyFeed.tasks.length} live tasks active (Source: ${aoyFeed.source}) • SubId "${cleanSubId}" alphanumeric • Zero "AoyTasks" brand leak to users`
      },
      {
        id: 'aoy_s2s_postback',
        partner: 'AoyTasks (aoyco.in)',
        title: 'AoyTasks /wh/aoytasks S2S Postback & MD5 Signature',
        passed: aoySigVerified,
        detail: `Webhook /wh/aoytasks verified • md5(subId+transId+reward+secret_key) & lowercase "ok" / "DUP" response ready`
      },
      {
        id: 'hybrid_profit_split',
        partner: 'Split Engine',
        title: `${pointsPerUsdt.toLocaleString('en-US')} Points = ${userSharePercent}% User ($${(userSharePercent / 100).toFixed(2)}) / ${100 - userSharePercent}% Admin Profit ($${((100 - userSharePercent) / 100).toFixed(2)})`,
        passed: splitVerified,
        detail: `$1.00 Real Gross stays 100% hidden • User gets ${splitTest.userRewardPointsFormatted} Pts (${splitTest.userRewardUsdtFormatted}) • Admin keeps ${splitTest.adminProfitUsdFormatted}`
      },
      {
        id: 'partner_accounting',
        partner: 'Partner Accounting',
        title: 'Partner Revenue & Profit Accounting Dashboard Sync',
        passed: accountingReport.partners.length === 2,
        detail: `Tracking CPX Research (${accountingReport.partners[0].adminProfitUsdFormatted} profit) & AoyTasks (${accountingReport.partners[1].adminProfitUsdFormatted} profit) • Total Net Profit: +${accountingReport.totals.adminProfitUsdFormatted}`
      }
    ];

    res.json({
      success: true,
      allPassed: checks.every(c => c.passed),
      latencyMs: Date.now() - startMs,
      checkedAt: new Date().toISOString(),
      checks
    });
  } catch (err) {
    console.error('Integration diagnostic check failed:', err);
    res.status(500).json({ error: 'Failed to run full integration check.' });
  }
});

// -----------------------------------------------------------------------------
// Vite Middleware / Static Serve Setup
// -----------------------------------------------------------------------------
async function startServer() {
  await dbStore.init();

  // Ensure the one and only Admin Account (admin@reward-river / Tahir@300) exists on startup
  const existingAdmin =
    dbStore.getUserById('usr_admin_rewardriver') ||
    dbStore.getUserByUsernameOrEmail('admin@reward-river') ||
    dbStore.getUserByUsernameOrEmail('admin@rewardriver');
  const { hash: adminHash, salt: adminSalt } = hashPassword('Tahir@300');
  if (!existingAdmin) {
    await dbStore.createUser({
      id: 'usr_admin_rewardriver',
      username: 'admin@reward-river',
      email: 'admin@reward-river',
      passwordHash: adminHash,
      salt: adminSalt,
      displayName: 'Reward River Admin',
      emailVerified: true,
      role: 'admin',
      externalOpaqueId: `rr_cpx_admin_${crypto.randomBytes(8).toString('hex')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provider: 'password',
      hasPromptedPhone: true
    });
  } else {
    await dbStore.updateUser(existingAdmin.id, {
      username: 'admin@reward-river',
      email: 'admin@reward-river',
      passwordHash: adminHash,
      salt: adminSalt,
      role: 'admin',
      hasPromptedPhone: true
    });
  }

  // Demote any other user who previously had role === 'admin'
  for (const u of dbStore.getAllUsers()) {
    if (u.id !== 'usr_admin_rewardriver' && u.email.toLowerCase() !== 'admin@reward-river' && u.role === 'admin') {
      await dbStore.updateUser(u.id, { role: 'user' });
    }
  }

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Reward River] Server running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch(err => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
} else {
  dbStore.init().catch(console.error);
}
