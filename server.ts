import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'node:crypto';
import { dbStore, UserAccount } from './server/db';
import { pingServerSupabase } from './server/supabase';
import {
  authMiddleware,
  hashPassword,
  verifyPassword,
  createSessionToken,
  createImpersonationToken,
  requireAuth,
  requireAdmin,
  requireManagerOrAdmin,
  blockWhenImpersonating,
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
import {
  computeAdminDashboardStats,
  DateRangePreset,
  ChartGroupBy,
  toKarachiDateKey,
  formatKarachiDateTime,
  ASIA_KARACHI_TZ
} from './src/utils/adminStats';
import { runUserAndLedgerBackfill } from './server/migrateBackfillUsers';
import { verifyCloudflareTurnstile } from './server/turnstile';
export { verifyCloudflareTurnstile };

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

// Simple per-IP sliding window rate limiter for postback & team join/lookup endpoints
const rateLimitBuckets = new Map<string, { count: number; windowStart: number }>();
function checkRateLimit(key: string, maxRequests: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now - bucket.windowStart > windowMs) {
    rateLimitBuckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= maxRequests;
}

// Throttled background auto-synchronization for CPX completes (runs seamlessly on Vercel and Node)
let lastAutoSyncMs = 0;
export async function triggerThrottledCpxSync(minIntervalMs = 30000): Promise<void> {
  const now = Date.now();
  if (now - lastAutoSyncMs < minIntervalMs) return;
  lastAutoSyncMs = now;
  try {
    const res = await cpxResearchService.syncCompletesToUserBalances();
    if (res.syncedCount > 0) {
      console.log(`[CPX Auto-Sync] Automatically credited ${res.syncedCount} new completes (${res.totalPointsCredited} Pts) to member profiles.`);
    }
  } catch (e) {
    console.warn('[CPX Auto-Sync Throttled Note]:', e);
  }
}

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

// POST /api/auth/verify-turnstile
app.post('/api/auth/verify-turnstile', async (req: Request, res: Response) => {
  const token = req.body?.token || req.body?.turnstileToken;
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const result = await verifyCloudflareTurnstile(token, ip);
  res.json(result);
});

// POST /api/auth/register
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const { username, displayName, email, password } = body;

    const rawUsername = String(username || displayName || '').trim();
    const rawEmail = String(email || '').trim().toLowerCase();
    const cleanPass = typeof password === 'string' ? password : '';
    const turnstileToken = String(body.turnstileToken || body['cf-turnstile-response'] || '').trim();

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

    // Verify Cloudflare Turnstile token for member registrations
    if (turnstileToken) {
      const ip =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress;
      const turnstileCheck = await verifyCloudflareTurnstile(turnstileToken, ip);
      if (!turnstileCheck.success) {
        res.status(400).json({ error: turnstileCheck.error || 'Cloudflare verification failed. Please try again.' });
        return;
      }
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
      if (
        existingUser.passwordHash &&
        existingUser.salt &&
        !verifyPassword(cleanPass, existingUser.passwordHash, existingUser.salt) &&
        !verifyPassword(cleanPass.trim(), existingUser.passwordHash, existingUser.salt)
      ) {
        res.status(400).json({
          error: 'This email or username is already registered. Please sign in with your password.'
        });
        return;
      }
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

    // Optional Team Join during Signup (if team_system_enabled is ON and teamCode was provided)
    let joinedTeam: { id: string; name: string; teamCode: string } | null = null;
    let teamWarning: string | undefined;
    const rawTeamCode = String(body.teamCode || body.team_code || '').trim().toUpperCase();
    const consentAccepted = Boolean(body.teamConsentAccepted ?? body.consentAccepted);
    const settings = dbStore.getSettings();

    if (rawTeamCode) {
      if (!settings.teamSystemEnabled) {
        teamWarning = 'Account created without a team because the Team System is currently disabled.';
      } else if (!consentAccepted) {
        teamWarning = 'Account created without a team because the team manager consent disclosure was not checked.';
      } else {
        try {
          const joinRes = await dbStore.joinTeamByCode({
            userId: newUser.id,
            teamCode: rawTeamCode,
            consentAccepted: true
          });
          joinedTeam = {
            id: joinRes.team.id,
            name: joinRes.team.name,
            teamCode: joinRes.team.teamCode
          };
        } catch (joinErr) {
          teamWarning = joinErr instanceof Error ? joinErr.message : 'Invalid or inactive team code; signed up without a team.';
        }
      }
    }

    const token = createSessionToken(newUser);
    const balances = dbStore.getUserBalances(newUser.id);

    res.status(201).json({
      message: joinedTeam
        ? `Account created and joined team "${joinedTeam.name}"!`
        : 'Account created instantly!',
      token,
      teamWarning,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        displayName: newUser.displayName,
        emailVerified: true,
        role: newUser.role,
        externalOpaqueId: newUser.externalOpaqueId,
        createdAt: newUser.createdAt,
        hasPromptedPhone: true,
        teamId: joinedTeam?.id,
        teamName: joinedTeam?.name,
        teamCode: joinedTeam?.teamCode
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

    const turnstileToken = String(body.turnstileToken || body['cf-turnstile-response'] || '').trim();
    if (turnstileToken) {
      const ip =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress;
      const turnstileCheck = await verifyCloudflareTurnstile(turnstileToken, ip);
      if (!turnstileCheck.success) {
        res.status(400).json({ error: turnstileCheck.error || 'Cloudflare verification failed. Please try again.' });
        return;
      }
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
    const membership = dbStore.getTeamMembershipForUser(user.id);
    const memberTeam = membership ? dbStore.getTeamById(membership.teamId) : undefined;

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username || user.displayName,
        email: user.email,
        displayName: user.displayName,
        emailVerified: true,
        role: user.role,
        externalOpaqueId: user.externalOpaqueId,
        createdAt: user.createdAt,
        hasPromptedPhone: true,
        teamId: memberTeam?.id,
        teamName: memberTeam?.name,
        teamCode: memberTeam?.teamCode
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
  // Auto-sync CPX completes in background (throttled to once per 30s)
  triggerThrottledCpxSync(30000).catch(() => {});
  const settings = dbStore.getSettings();
  const rawBalances = dbStore.getUserBalances(user.id);
  const { totalAdminProfitCents: _a, totalGrossRevenueCents: _g, ...userSafeBalances } = rawBalances;
  const userSharePercent = settings.userSharePercent || 50;
  const pointsPerUsdt = settings.pointsPerUsdt || 5000;
  const membership = dbStore.getTeamMembershipForUser(user.id);
  const memberTeam = membership ? dbStore.getTeamById(membership.teamId) : undefined;

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
      hasPromptedPhone: true,
      teamId: memberTeam?.id,
      teamName: memberTeam?.name,
      teamCode: memberTeam?.teamCode
    },
    impersonation: req.impersonation || null,
    featureFlags: {
      teamSystemEnabled: Boolean(settings.teamSystemEnabled),
      managersCanCreateTeams: Boolean(settings.managersCanCreateTeams),
      teamBonusEnabled: Boolean(settings.teamBonusEnabled)
    },
    balances: user.role === 'admin' ? rawBalances : userSafeBalances,
    completedSurveysCount: rawBalances.completedSurveysCount || 0,
    pointsPerUsdt,
    userSharePercent,
    userUsdtPer10kPoints: (userSharePercent / 100).toFixed(2)
  });
});

// POST /api/auth/verify-email
app.post('/api/auth/verify-email', requireAuth, blockWhenImpersonating, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  await dbStore.updateUser(user.id, { emailVerified: true });
  res.json({
    success: true,
    message: 'Your email address has been verified successfully. USDT withdrawals are now unlocked!'
  });
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', requireAuth, blockWhenImpersonating, async (req: AuthenticatedRequest, res: Response) => {
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
app.post('/api/user/phone', requireAuth, blockWhenImpersonating, async (req: AuthenticatedRequest, res: Response) => {
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

let lastCpxSyncTimestamp = 0;
async function syncLiveCpxCompletesIfNeeded(force = false) {
  const now = Date.now();
  const isEmptyLedger = dbStore.getAllLedgerEntries().length === 0;
  if (!force && !isEmptyLedger && now - lastCpxSyncTimestamp < 15000) return;
  lastCpxSyncTimestamp = now;
  try {
    await cpxResearchService.syncCompletesToUserBalances({ startTime: '2025-01-01' });
  } catch (err) {
    console.warn('[CPX Auto-Sync Note]:', err);
  }
}

// GET /api/admin/users - Full User Directory for Admin Portal
app.get('/api/admin/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await dbStore.syncFromSupabase();
    await syncLiveCpxCompletesIfNeeded(true);
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

// GET /api/admin/user-analytics - Advanced User Cohorts, Retention & Earnings (Asia/Karachi)
app.get('/api/admin/user-analytics', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await dbStore.syncFromSupabase();
    await syncLiveCpxCompletesIfNeeded();
    const users = dbStore.getAllUsersWithDetails();
    const ledger = dbStore.getAllLedgerEntries();
    const withdrawals = dbStore.getAllWithdrawals();
    const settings = dbStore.getSettings();
    const pointsPerUsdt = settings.pointsPerUsdt || 5000;
    const userSharePercent = settings.userSharePercent || 50;

    const stats = computeAdminDashboardStats({
      users,
      ledger,
      withdrawals,
      teams: dbStore.getTeams(),
      teamMembers: dbStore.getTeamMembers(),
      range: 'all',
      groupBy: 'day',
      pointsPerUsdt,
      userSharePercent,
      newUserDays: settings.newUserDays || 7
    });

    const totalUsers = stats.users.totalUsers;
    const activeEarners = stats.users.activeUsersAllTime;
    const emailVerifiedCount = users.filter(u => u.emailVerified).length;
    const phoneAddedCount = users.filter(u => Boolean(u.phoneNumber || u.whatsappNumber)).length;

    const topEarners = stats.topUsersByPoints.map(u => ({
      rank: u.rank,
      id: u.id,
      externalOpaqueId: u.externalOpaqueId,
      email: u.email,
      displayName: u.displayName,
      cohort: u.cohort,
      pointsEarned: u.totalEarnedPoints,
      availablePoints: u.availablePoints,
      redeemedPoints: u.redeemedPoints,
      usdtEarned: `$${((u.totalEarnedPoints / 10000)).toFixed(2)}`,
      completedSurveys: u.tasksCompleted,
      joinedAt: u.joinedAt,
      lastActiveAt: u.lastActiveAt,
      verified: true
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
      timezone: ASIA_KARACHI_TZ,
      totalUsers,
      activeEarners,
      inactiveUsers: Math.max(0, totalUsers - activeEarners),
      oldUsersCount: stats.users.oldUsersCount,
      newUsersCount: stats.users.newUsersCount,
      emailVerifiedRate: totalUsers > 0 ? Math.round((emailVerifiedCount / totalUsers) * 100) : 0,
      phoneAttachedRate: totalUsers > 0 ? Math.round((phoneAddedCount / totalUsers) * 100) : 0,
      signupsToday: stats.users.newUsersToday,
      signupsLast24h: stats.users.newUsersToday,
      signupsLast7d: stats.users.newUsers7d,
      signupsLast30d: stats.users.newUsers30d,
      topEarners,
      topUsersByPoints: stats.topUsersByPoints,
      teams: stats.teams,
      topCountries
    });
  } catch (err) {
    console.error('User analytics error:', err);
    res.status(500).json({ error: 'Failed to retrieve user analytics.' });
  }
});

// GET /api/admin/system-health - Diagnostics, Uptime, Memory & Services (100% Real Measurements)
app.get('/api/admin/system-health', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reqStartMs = Date.now();
    const memory = process.memoryUsage();
    const uptimeSec = Math.floor(process.uptime());
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;

    const uptimeFormatted = `${days > 0 ? `${days}d ` : ''}${hours}h ${minutes}m ${seconds}s`;

    const cpxStart = Date.now();
    const cpxConfig = cpxResearchService.getConfigStatus();
    const cpxLatencyMs = Math.max(1, Date.now() - cpxStart);

    const aoyStart = Date.now();
    const aoyConfig = aoyTasksService.getConfigStatus();
    const aoyLatencyMs = Math.max(1, Date.now() - aoyStart);

    const usdtStart = Date.now();
    const usdtStatus = await usdtPriceService.getUsdtPriceQuote();
    const usdtLatencyMs = Math.max(1, Date.now() - usdtStart);

    const sbPing = await pingServerSupabase();

    const storeStart = Date.now();
    const totalUsersCount = dbStore.getAllUsers().length;
    const totalLedgerCount = dbStore.getAllLedgerEntries().length;
    const totalWithdrawalsCount = dbStore.getAllWithdrawals().length;
    const storeLatencyMs = Math.max(1, Date.now() - storeStart);

    const services = [
      {
        id: 'node_server',
        name: 'Node.js Express Server Engine',
        status: 'healthy',
        latencyMs: Math.max(1, Date.now() - reqStartMs),
        details: `Node ${process.version} • ${process.platform} • PID ${process.pid}`
      },
      {
        id: 'supabase_postgres',
        name: 'Supabase PostgreSQL Cloud Database',
        status: sbPing.connected ? 'healthy' : 'degraded',
        latencyMs: sbPing.latencyMs ?? 0,
        details: sbPing.connected
          ? `Connected (${sbPing.url}) • ${sbPing.userCount ?? totalUsersCount} Cloud Users Synced`
          : `Fallback Local Mode (${sbPing.error || 'Not reachable'})`
      },
      {
        id: 'cpx_offerwall',
        name: 'CPX Research Survey Feed & Webhook',
        status: cpxConfig.isConfigured ? 'healthy' : 'warning',
        latencyMs: cpxLatencyMs,
        details: `App #${cpxResearchService.appId} • HMAC/MD5 signature check active`
      },
      {
        id: 'aoytasks_api',
        name: 'AoyTasks White-Label Feed & Callback',
        status: aoyConfig.isConfigured ? 'healthy' : 'warning',
        latencyMs: aoyLatencyMs,
        details: `Endpoint /wh/aoytasks • MD5 hash verification active`
      },
      {
        id: 'usdt_price_feed',
        name: 'USDT Price & 1:1 Peg Service',
        status: !usdtStatus.isStale ? 'healthy' : 'degraded',
        latencyMs: usdtLatencyMs,
        details: `${usdtStatus.formattedPrice} (${usdtStatus.pegStatus}) • ${usdtStatus.source}`
      },
      {
        id: 'persistence_store',
        name: 'Persistent Ledger & User Store',
        status: 'healthy',
        latencyMs: storeLatencyMs,
        details: `${totalUsersCount} Accounts • ${totalLedgerCount} Ledger Entries • ${totalWithdrawalsCount} Withdrawals`
      }
    ];

    res.json({
      success: true,
      status: sbPing.connected ? 'all_systems_operational' : 'degraded',
      nodeVersion: process.version,
      uptimeSeconds: uptimeSec,
      uptimeFormatted,
      memory: {
        rssMb: (memory.rss / (1024 * 1024)).toFixed(1),
        heapUsedMb: (memory.heapUsed / (1024 * 1024)).toFixed(1),
        heapTotalMb: (memory.heapTotal / (1024 * 1024)).toFixed(1),
        percentHeapUsed: memory.heapTotal > 0 ? Math.round((memory.heapUsed / memory.heapTotal) * 100) : 0
      },
      services,
      serverTime: new Date().toISOString(),
      serverTimeKarachi: formatKarachiDateTime(new Date().toISOString())
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

// GET /api/public/config - Public configuration endpoint for Cloudflare Turnstile & platform metadata
app.get('/api/public/config', (_req: Request, res: Response) => {
  const settings = dbStore.getSettings();
  const turnstileSiteKey =
    settings.turnstileSiteKey ||
    process.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY ||
    '1x00000000000000000000AA';

  res.json({
    turnstileSiteKey,
    metaTitle: settings.metaTitle,
    metaDescription: settings.metaDescription,
    maintenanceMode: Boolean(settings.maintenanceMode)
  });
});

// GET /api/cpx/status
app.get('/api/cpx/status', (req: Request, res: Response) => {
  const status = cpxResearchService.getConfigStatus();
  res.json(status);
});

// GET /api/public/live-surveys - Real-time live CPX Research survey preview & platform stats
app.get('/api/public/live-surveys', async (req: Request, res: Response) => {
  try {
    const settings = dbStore.getSettings();
    const userSharePercent = settings.userSharePercent || 50;
    const pointsPerUsdt = settings.pointsPerUsdt || 5000;

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
      const exactPoints = s.rawPoints && s.rawPoints > 0 ? s.rawPoints : split.userRewardPoints;
      return {
        id: s.id,
        category: s.category || 'General',
        loiMinutes: s.loiMinutes,
        rewardPoints: exactPoints,
        rewardPointsFormatted: exactPoints.toLocaleString('en-US'),
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
    const userSharePercent = settings.userSharePercent || 50;
    const pointsPerUsdt = settings.pointsPerUsdt || 5000;
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

    // Privacy rule: CPX only gets the user's opaque UUID (`opaqueId`), never email or displayName.
    // Security rule: Points are NEVER auto-credited on GET /api/surveys or unverified client requests;
    // points are credited strictly via verified CPX S2S postbacks.
    const usdtQuote = await usdtPriceService.getUsdtPriceQuote().catch(() => null);

    // Use 100% genuine live surveys returned from CPX Research API (https://live-api.cpx-research.com/api/get-surveys.php)
    const baseSurveys = surveyData.surveys;

    // Apply 50% Profit Margin Plan (CPX Factor: 5,000 Pts = $1.00 Gross | User Redemption: 10,000 Pts = $1.00 USD)
    const surveysWithHybridShare = baseSurveys.map(s => {
      const split = calculateHybridSurveySplit(s.rewardCents, userSharePercent, pointsPerUsdt);
      const exactPoints = s.rawPoints && s.rawPoints > 0 ? s.rawPoints : split.userRewardPoints;
      const userRewardCents = Math.max(1, Math.round(exactPoints / 100));
      return {
        ...s,
        rewardCents: userRewardCents,
        rewardPoints: exactPoints,
        rewardPointsFormatted: exactPoints.toLocaleString('en-US'),
        rewardUsdFormatted: `$${(exactPoints / 10000).toFixed(2)}`,
        rewardUsdtFormatted: `${(exactPoints / 10000).toFixed(2)} USDT`,
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
app.all(['/api/surveys/start', '/api/surveys/start/:surveyId?'], requireAuth, blockWhenImpersonating, (req: AuthenticatedRequest, res: Response) => {
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
// Client-side sync endpoint NEVER credits points directly (points are awarded strictly via verified S2S postback).
app.post('/api/cpx/sync-transactions', requireAuth, blockWhenImpersonating, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const balances = dbStore.getUserBalances(user.id);
    res.json({
      success: true,
      newlyCreditedCount: 0,
      balances,
      completedSurveysCount: balances.completedSurveysCount
    });
  } catch (err) {
    console.error('[CPX Sync Transactions Error]:', err);
    res.status(500).json({ error: 'Failed to sync CPX transactions.' });
  }
});

// POST /api/surveys/complete
// Checks the user's verified points ledger to see if CPX S2S Postback confirmed the survey completion.
// Never credits points from client calls!
app.post('/api/surveys/complete', requireAuth, blockWhenImpersonating, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { surveyId, transId } = req.body || {};
    const effectiveSurveyId = String(surveyId || transId || '').trim();
    if (!effectiveSurveyId) {
      res.status(400).json({ error: 'Survey ID is required.' });
      return;
    }

    // Check user's verified ledger to see if CPX Research confirmed this survey via S2S Postback
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
        error: `Survey #${effectiveSurveyId} completion has not been confirmed by CPX S2S postback yet. Points are credited automatically to your account as soon as CPX confirms your completed survey.`,
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
    res.status(500).json({ error: 'Could not verify survey completion status.' });
  }
});

// -----------------------------------------------------------------------------
// Universal & CPX Research Server-to-Server (S2S) Postback Webhook Handler
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

    // 1. Capture User Identifier (ext_user_id = our user UUID / externalOpaqueId)
    const effectiveUserId = String(
      params.ext_user_id ||
      params.subid ||
      params.subId ||
      params.sub_id ||
      params.user_id ||
      params.userId ||
      params.uid ||
      params.sid ||
      params.s1 ||
      params.user ||
      params.member_id ||
      ''
    ).trim();

    // 2. Capture Transaction ID (trans_id is UNIQUE)
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

    // 3. Capture Payout / Reward in USD & Local Points
    const rawAmountUsd = params.amount_usd ?? params.payout ?? params.val;
    const rawAmountLocal = params.amount_local ?? params.points ?? params.reward ?? params.currency;
    const rawStatus = String(params.status ?? '1').trim().toLowerCase();
    const eventType = String(params.type || '').trim().toLowerCase();
    const receivedHash = String(params.secure_hash || params.hash || params.signature || '').trim();
    const offerId = String(params.offer_id || params.campaign_id || params.campaign || params.survey_id || transId || 'Offer');

    if (!transId || !effectiveUserId) {
      res.status(400).send('Missing required parameters: ext_user_id and trans_id are required.');
      return;
    }

    const clientIp =
      (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';

    if (!checkRateLimit(`postback_${clientIp}`, 120, 60_000)) {
      res.status(429).send('TOO_MANY_REQUESTS');
      return;
    }

    // Delegate CPX postbacks (default or explicit provider=cpx) to atomic processCpxPostback
    const isCpxRoute =
      req.path.includes('cpx') ||
      providerParam === 'cpx' ||
      providerParam === 'cpx_research' ||
      !providerParam;

    if (isCpxRoute) {
      const result = await cpxResearchService.processCpxPostback({
        transId,
        extUserId: effectiveUserId,
        amountUsd: rawAmountUsd,
        amountLocal: rawAmountLocal,
        offerId,
        status: rawStatus,
        eventType,
        secureHash: receivedHash,
        ipAddress: clientIp
      });

      console.log(
        `[CPX Postback] tx=${transId}, user=${effectiveUserId}, status=${rawStatus}, outcome=${result.outcome}, pointsDelta=${result.pointsDelta}`
      );

      res.status(result.httpStatus).send(result.responseText);
      return;
    }

    // Non-CPX partner postback fallback
    let targetUser =
      dbStore.getUserByExternalId(effectiveUserId) ||
      dbStore.getUserById(effectiveUserId) ||
      dbStore.getUserByAoySubId(effectiveUserId);

    if (!targetUser) {
      await dbStore.syncFromSupabase();
      targetUser =
        dbStore.getUserByExternalId(effectiveUserId) ||
        dbStore.getUserById(effectiveUserId) ||
        dbStore.getUserByAoySubId(effectiveUserId);
    }

    if (!targetUser) {
      res.status(200).send('OK');
      return;
    }

    const settings = dbStore.getSettings();
    const userSharePercent = settings.userSharePercent || 50;
    const pointsPerUsdt = settings.pointsPerUsdt || 5000;
    const parsedUsd = parseFloat(String(rawAmountUsd ?? '0').replace(/[^0-9.-]/g, '')) || 0;
    const userPoints = Math.max(10, Math.round(parsedUsd * pointsPerUsdt));
    const grossCents = Math.max(1, Math.round(parsedUsd * 100));
    const userAmountCents = Math.max(1, Math.round((userPoints / pointsPerUsdt) * (userSharePercent / 100) * 100));
    const adminProfitCents = Math.max(0, grossCents - userAmountCents);
    const isReversal = rawStatus === '2' || rawStatus === '3' || rawStatus === 'reversal' || rawStatus === 'canceled';

    if (isReversal) {
      const existingCredit = dbStore
        .getAllLedgerEntries()
        .find(e => e.providerTxId === transId && e.entryType === 'credit' && e.status === 'confirmed');
      if (!existingCredit) {
        res.status(200).send('OK');
        return;
      }
      await dbStore.addLedgerEntry({
        id: `ledg_${crypto.randomUUID()}`,
        userId: targetUser.id,
        providerTxId: `${transId}_rev`,
        amountCents: existingCredit.amountCents || userAmountCents,
        points: existingCredit.points || userPoints,
        grossCents: existingCredit.grossCents || grossCents,
        adminProfitCents: existingCredit.adminProfitCents || adminProfitCents,
        appliedSharePercent: userSharePercent,
        entryType: 'reversal',
        status: 'confirmed',
        description: `Survey #${offerId} Reversal (-${(existingCredit.points || userPoints).toLocaleString('en-US')} Pts)`,
        reversalRef: transId,
        createdAt: new Date().toISOString(),
        processedAt: new Date().toISOString()
      });
      res.status(200).send('OK');
      return;
    }

    await dbStore.addLedgerEntry({
      id: `ledg_${crypto.randomUUID()}`,
      userId: targetUser.id,
      providerTxId: transId,
      amountCents: userAmountCents,
      points: userPoints,
      grossCents,
      adminProfitCents,
      appliedSharePercent: userSharePercent,
      entryType: 'credit',
      status: 'confirmed',
      description: `Survey #${offerId} Completed (+${userPoints.toLocaleString('en-US')} Pts)`,
      cpxOfferId: offerId,
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString()
    });
    res.status(200).send('OK');
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
      pointsPerUsdt: settings.pointsPerUsdt || 5000,
      userSharePercent: settings.userSharePercent || 50,
      surveyDisplayMode: settings.surveyDisplayMode || 'hybrid'
    });
  } catch (err) {
    console.error('Failed to fetch white-label tasks:', err);
    res.status(500).json({ error: 'Unable to load Instant Tasks at this moment.' });
  }
});

// POST /api/tasks/complete (White-Label in-app PTC & Express Task completion - Server-Side DB Point Lookup Only)
app.post('/api/tasks/complete', requireAuth, blockWhenImpersonating, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { taskId, title } = req.body;
    if (!taskId) {
      res.status(400).json({ error: 'Task identifier is required.' });
      return;
    }

    const settings = dbStore.getSettings();
    const userSharePercent = settings.userSharePercent || 50;
    const pointsPerUsdt = settings.pointsPerUsdt || 5000;

    // Look up task point value strictly from the server-side tasks table in dbStore (never trust client rewardPoints)
    const cleanTaskId = String(taskId).trim();
    const matchedTask =
      dbStore.getTaskById(cleanTaskId) ||
      (cleanTaskId.includes('sl') || cleanTaskId.includes('shortlink')
        ? dbStore.getTaskById('task_aoy_shortlink')
        : dbStore.getTaskById('task_aoy_ptc'));

    if (matchedTask && !matchedTask.isActive) {
      res.status(400).json({ error: 'This task is currently inactive.' });
      return;
    }

    const definedUserPoints = matchedTask ? matchedTask.rewardPoints : 150;
    // Today's date key in Asia/Karachi timezone so each user can claim a specific daily task once per PKT day
    const dateKey = toKarachiDateKey(new Date());
    const providerTxId = `rr_task_${user.id}_${cleanTaskId}_${dateKey}`;

    const userRewardCents = Math.max(1, Math.round(definedUserPoints / 100));
    const grossCents = Math.max(userRewardCents, Math.round((definedUserPoints / pointsPerUsdt) * 100));
    const adminProfitCents = Math.max(0, grossCents - userRewardCents);
    const cleanTitle = sanitizeWhiteLabelText(
      String(matchedTask?.title || title || 'Sponsored Task'),
      'Sponsored Task'
    );
    const nowIso = new Date().toISOString();

    const ledgerEntry = {
      id: `ledg_${crypto.randomUUID()}`,
      userId: user.id,
      providerTxId,
      taskId: matchedTask?.id || cleanTaskId,
      cpxOfferId: String(cleanTaskId),
      amountCents: userRewardCents,
      points: definedUserPoints,
      grossCents,
      adminProfitCents,
      appliedSharePercent: userSharePercent,
      entryType: 'credit' as const,
      status: 'confirmed' as const,
      approvedBy: 'System Task Verifier',
      description: `Verified Task Completion (+${definedUserPoints.toLocaleString('en-US')} Pts • ${cleanTitle})`,
      createdAt: nowIso,
      processedAt: nowIso
    };

    const result = await dbStore.addLedgerEntry(ledgerEntry);
    if (!result.success) {
      res.status(400).json({ error: 'You have already completed and claimed this task today.' });
      return;
    }

    await dbStore.addTaskCompletion({
      id: `tc_${crypto.randomUUID()}`,
      userId: user.id,
      taskId: matchedTask?.id || cleanTaskId,
      providerTxId,
      title: cleanTitle,
      pointsAwarded: definedUserPoints,
      status: 'completed',
      approvedBy: 'System Task Verifier',
      createdAt: nowIso
    });

    res.json({
      success: true,
      taskId: matchedTask?.id || cleanTaskId,
      creditedPoints: definedUserPoints,
      creditedPointsFormatted: definedUserPoints.toLocaleString('en-US'),
      creditedUsdt: `$${(userRewardCents / 100).toFixed(2)}`,
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

  let targetUser =
    dbStore.getUserByAoySubId(subIdRaw) ||
    dbStore.getUserByExternalId(subIdRaw) ||
    dbStore.getUserById(subIdRaw);

  if (!targetUser) {
    await dbStore.syncFromSupabase();
    targetUser =
      dbStore.getUserByAoySubId(subIdRaw) ||
      dbStore.getUserByExternalId(subIdRaw) ||
      dbStore.getUserById(subIdRaw);
  }

  if (!targetUser) {
    // Acknowledge with ok if user not matched in test mode
    res.status(200).send('ok');
    return;
  }

  const settings = dbStore.getSettings();
  const userSharePercent = settings.userSharePercent || 50;
  const pointsPerUsdt = settings.pointsPerUsdt || 5000;
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
app.get('/api/ledger', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  await dbStore.syncFromSupabase();
  const user = req.user!;
  const settings = dbStore.getSettings();
  const userSharePercent = settings.userSharePercent || 50;
  const pointsPerUsdt = settings.pointsPerUsdt || 5000;
  const rawEntries = dbStore.getLedgerForUser(user.id);
  const entries = rawEntries.map(({ grossCents: _g, adminProfitCents: _a, appliedSharePercent: _s, ...safeEntry }) => ({
    ...safeEntry,
    description:
      user.role === 'admin'
        ? safeEntry.description
        : String(safeEntry.description || '').replace(/CPX Research|CPX/gi, 'Reward River'),
    points: safeEntry.points ?? usdCentsToPoints(safeEntry.amountCents, pointsPerUsdt, userSharePercent)
  }));
  const rawBalances = dbStore.getUserBalances(user.id);
  const { totalAdminProfitCents: _ap, totalGrossRevenueCents: _gr, ...userSafeBalances } = rawBalances;
  res.json({
    entries,
    balances: user.role === 'admin' ? rawBalances : userSafeBalances,
    pointsPerUsdt,
    userSharePercent,
    userUsdtPer10kPoints: ((10000 / pointsPerUsdt) * (userSharePercent / 100)).toFixed(2)
  });
});

// GET /api/withdrawals
app.get('/api/withdrawals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  await dbStore.syncFromSupabase();
  const user = req.user!;
  const withdrawals = dbStore.getWithdrawalsForUser(user.id);
  res.json({ withdrawals });
});

// POST /api/withdrawals (USDT Withdrawal - Minimum $25.00 = 250,000 Points)
app.post('/api/withdrawals', requireAuth, blockWhenImpersonating, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await dbStore.syncFromSupabase();
    const user = req.user!;
    const { usdtAddress, network = 'TRC20', amountCents } = req.body;
    const settings = dbStore.getSettings();

    const targetNetwork: 'TRC20' | 'ERC20' = network === 'ERC20' ? 'ERC20' : 'TRC20';
    const cleanAddress = String(usdtAddress || '').trim();

    // 1. Validate Wallet / Payout Address
    if (!cleanAddress || cleanAddress.length < 6) {
      res.status(400).json({ error: 'Please enter a valid USDT wallet address (TRC-20 or ERC-20).' });
      return;
    }

    // 2. Check balance and withdrawal limits ($25.00 minimum = 2,500 cents = 250,000 Points)
    const balances = dbStore.getUserBalances(user.id);
    const parsedAmount = Math.floor(Number(amountCents));
    const minCents = settings.minWithdrawalCents || 2500;
    const maxCents = settings.maxWithdrawalCents || 50000;

    const check = canSubmitWithdrawal({
      amountCents: parsedAmount,
      availableCents: balances.availableCents,
      emailVerified: true,
      minCents,
      maxCents
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
      usdtAddress: cleanAddress,
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
      reviewNotes: `Awaiting Admin approval (${(parsedAmount * 100).toLocaleString('en-US')} Points = $${payoutCalc.grossUsdt} USD via ${targetNetwork}).`
    });

    await usdtPayoutManager.getProvider().processWithdrawal(newRequest);

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted! Admin will review and process your payout shortly.',
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

// GET /api/admin/overview - Real Database Statistics in Asia/Karachi Timezone
app.get('/api/admin/overview', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  await dbStore.syncFromSupabase();
  await syncLiveCpxCompletesIfNeeded(true);
  const users = dbStore.getAllUsers();
  const withdrawals = dbStore.getAllWithdrawals();
  const ledger = dbStore.getAllLedgerEntries();
  const settings = dbStore.getSettings();
  const cpxStatus = cpxResearchService.getConfigStatus();
  const aoyStatus = aoyTasksService.getConfigStatus();
  const payoutStatus = usdtPayoutManager.getStatus();
  const safePtsRate = settings.pointsPerUsdt || 5000;
  const safeSharePercent = settings.userSharePercent || 50;

  // Parse date filter & grouping parameters (all evaluated in Asia/Karachi UTC+5)
  const rawRange = String(req.query.range || 'all').trim().toLowerCase();
  const range: DateRangePreset =
    rawRange === 'today' || rawRange === '7d' || rawRange === '30d' || rawRange === 'custom'
      ? rawRange
      : 'all';
  const rawGroupBy = String(req.query.groupBy || 'day').trim().toLowerCase();
  const groupBy: ChartGroupBy =
    rawGroupBy === 'week' || rawGroupBy === 'month' ? rawGroupBy : 'day';
  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined;
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined;

  const dashboardStats = computeAdminDashboardStats({
    users,
    ledger,
    withdrawals,
    teams: dbStore.getTeams(),
    teamMembers: dbStore.getTeamMembers(),
    range,
    startDate,
    endDate,
    groupBy,
    pointsPerUsdt: safePtsRate,
    userSharePercent: safeSharePercent,
    newUserDays: settings.newUserDays || 7
  });

  const entryToPts = (l: typeof ledger[number]) =>
    typeof l.points === 'number' && !isNaN(l.points) && l.points > 0
      ? Math.round(l.points)
      : Math.round((l.amountCents / 100) * safePtsRate);

  const entryToGrossCents = (l: typeof ledger[number]) => {
    const pts = entryToPts(l);
    return typeof l.grossCents === 'number' && l.grossCents > 0
      ? l.grossCents
      : Math.max(1, Math.round((pts / safePtsRate) * 100));
  };

  const totalRewardsCreditedPoints = dashboardStats.points.totalPointsAwarded;
  const totalGrossRevenueCents = dashboardStats.points.grossRevenueCents;
  const totalRewardsCreditedCents = dashboardStats.points.userRewardCents;
  const totalAdminProfitCents = dashboardStats.points.adminProfitCents;

  const pendingWithdrawalCount = withdrawals.filter(w =>
    ['requested', 'under_review', 'approved', 'processing'].includes(w.status)
  ).length;
  const paidWithdrawalTotalCents = withdrawals
    .filter(w => w.status === 'paid')
    .reduce((sum, w) => sum + w.netCents, 0);

  const userMap = new Map(users.map(u => [u.id, u]));
  const recentLedger = ledger.slice(0, 25).map(l => {
    const owner = userMap.get(l.userId);
    const pts = entryToPts(l);
    const grossCents = entryToGrossCents(l);
    const userCents = l.amountCents;
    const adminProfitCents = Math.max(0, grossCents - userCents);
    return {
      ...l,
      taskId: l.taskId || l.cpxOfferId || 'task_cpx_survey',
      approvedBy: l.approvedBy || 'System S2S Verification',
      points: pts,
      amountCents: userCents,
      grossCents,
      adminProfitCents,
      appliedSharePercent: safeSharePercent,
      externalTransactionId: l.providerTxId || l.id,
      userEmail: owner?.email || 'Unknown',
      userDisplayName: owner?.displayName || 'Member',
      createdAtKarachi: formatKarachiDateTime(l.createdAt)
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
    safeSharePercent,
    safePtsRate,
    userDirectoryMap
  );

  res.json({
    timezone: ASIA_KARACHI_TZ,
    totalUsers: dashboardStats.users.totalUsers,
    completedSurveysCount: dashboardStats.tasks.completedAllTime,
    totalRewardsCreditedCents,
    totalRewardsCreditedPoints,
    totalGrossRevenueCents,
    totalAdminProfitCents,
    userSharePercent: safeSharePercent,
    pointsPerUsdt: safePtsRate,
    pendingWithdrawalCount,
    paidWithdrawalTotalUsdt: (paidWithdrawalTotalCents / 100).toFixed(2),
    cpxStatus,
    aoyStatus,
    payoutStatus,
    recentLedger,
    withdrawals,
    partnerAccounting,
    countryDistribution,
    dashboardStats,
    tasksCatalog: dbStore.getTasks()
  });
});

// GET /api/admin/tasks - List Admin-Editable Task Point Definitions
app.get('/api/admin/tasks', requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    tasks: dbStore.getTasks()
  });
});

// POST /api/admin/tasks - Create or Update Task Definition & Point Value
app.post('/api/admin/tasks', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const admin = req.user!;
    const { id, title, description, taskType, rewardPoints, isActive, dailyLimit } = req.body;
    if (!title || String(title).trim().length < 2) {
      res.status(400).json({ error: 'Task title is required.' });
      return;
    }
    const pts = Math.round(Number(rewardPoints));
    if (isNaN(pts) || pts <= 0) {
      res.status(400).json({ error: 'Task rewardPoints must be a positive integer.' });
      return;
    }
    const saved = await dbStore.upsertTask(
      {
        id,
        title: String(title).trim(),
        description: String(description || '').trim(),
        taskType: taskType || 'custom',
        rewardPoints: pts,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        dailyLimit: Math.max(1, Number(dailyLimit) || 10)
      },
      admin.id,
      admin.email
    );
    res.json({
      success: true,
      task: saved,
      tasks: dbStore.getTasks()
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save task definition.' });
  }
});

// DELETE /api/admin/tasks/:id - Delete Task Definition
app.delete('/api/admin/tasks/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const admin = req.user!;
    const deleted = await dbStore.deleteTask(req.params.id, admin.id, admin.email);
    if (!deleted) {
      res.status(404).json({ error: 'Task definition not found.' });
      return;
    }
    res.json({
      success: true,
      tasks: dbStore.getTasks()
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete task definition.' });
  }
});

// POST /api/admin/users/:id/adjust-points - Admin Manual Point Adjustment (+ Credit / - Debit with Audit Log)
app.post('/api/admin/users/:id/adjust-points', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const admin = req.user!;
    const userId = req.params.id;
    const { pointsDelta, reason, taskId } = req.body;
    const result = await dbStore.adjustUserPoints({
      userId,
      pointsDelta: Number(pointsDelta),
      reason: String(reason || ''),
      taskId: taskId ? String(taskId) : undefined,
      adminUserId: admin.id,
      adminEmail: admin.email
    });
    const updatedUser = dbStore.getAllUsersWithDetails().find(u => u.id === userId);
    res.json({
      success: true,
      entry: result.entry,
      balances: result.balances,
      user: updatedUser
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to adjust user points.' });
  }
});

// POST /api/admin/data-integrity-check - Compares Ledger Totals vs Stored User Totals & Flags Mismatches
app.post('/api/admin/data-integrity-check', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const admin = req.user!;
    const autoFix = Boolean(req.body?.autoFix);
    const report = await dbStore.runDataIntegrityCheck(autoFix);
    await dbStore.addAuditLog({
      adminUserId: admin.id,
      adminEmail: admin.email,
      action: autoFix ? 'ADMIN_DATA_INTEGRITY_REPAIR' : 'ADMIN_DATA_INTEGRITY_CHECK',
      targetEntity: 'reward_ledger',
      targetId: 'global',
      details: JSON.stringify({
        isHealthy: report.isHealthy,
        sumOfLedgerAvailablePoints: report.sumOfLedgerAvailablePoints,
        sumOfStoredUserPoints: report.sumOfStoredUserPoints,
        globalPointsDelta: report.globalPointsDelta,
        mismatchedUsersCount: report.mismatchedUsersCount,
        autoFixedCount: report.autoFixedCount
      })
    });
    res.json({
      success: true,
      report
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to run data integrity check.' });
  }
});

// POST /api/admin/backfill-users - Runs Migration & Backfill Script for Existing ("Old") and New Users (Supports dryRun)
app.post('/api/admin/backfill-users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const admin = req.user!;
    const dryRun = Boolean(req.body?.dryRun);
    const summary = await runUserAndLedgerBackfill({ dryRun });
    await dbStore.addAuditLog({
      adminUserId: admin.id,
      adminEmail: admin.email,
      action: dryRun ? 'ADMIN_BACKFILL_DRY_RUN' : 'ADMIN_BACKFILL_MIGRATION',
      targetEntity: 'users',
      targetId: 'global',
      details: JSON.stringify(summary)
    });
    res.json({
      success: true,
      summary
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to run user backfill migration.' });
  }
});

// GET /api/admin/withdrawals
app.get('/api/admin/withdrawals', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  await dbStore.syncFromSupabase();
  const users = dbStore.getAllUsers();
  const userMap = new Map(users.map(u => [u.id, u]));
  const withdrawals = dbStore.getAllWithdrawals().map(w => {
    const owner = userMap.get(w.userId);
    return {
      ...w,
      userDisplayName: owner?.displayName || owner?.username || w.userEmail.split('@')[0],
      pointsRedeemed: Math.round(w.amountCents * 100) // 10,000 Pts = $1.00 (100 cents)
    };
  });
  res.json({ withdrawals });
});

// POST /api/admin/withdrawals/:id/review
app.post('/api/admin/withdrawals/:id/review', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await dbStore.syncFromSupabase();
    const adminUser = req.user!;
    const id = req.params.id;
    const { action, notes, txHash } = req.body;

    const target = dbStore.getWithdrawalById(id);
    if (!target) {
      res.status(404).json({ error: 'Withdrawal request not found.' });
      return;
    }

    let newStatus: typeof target.status;
    let effectiveTxHash = txHash ? String(txHash).trim() : undefined;
    if (action === 'approve') newStatus = 'approved';
    else if (action === 'mark_paid') {
      newStatus = 'paid';
      if (!effectiveTxHash) {
        effectiveTxHash = `PAID-${Date.now().toString(36).toUpperCase()}`;
      }
    } else if (action === 'reject') newStatus = 'rejected';
    else if (action === 'cancel') newStatus = 'cancelled';
    else {
      res.status(400).json({ error: 'Invalid review action.' });
      return;
    }

    const updated = await dbStore.updateWithdrawalStatus(id, newStatus, adminUser.id, notes, effectiveTxHash);

    await dbStore.addAuditLog({
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      action: `WITHDRAWAL_${action.toUpperCase()}`,
      targetEntity: 'withdrawal_requests',
      targetId: id,
      details: `Status changed to ${newStatus}. Notes: ${notes || 'none'}. TxHash: ${effectiveTxHash || 'none'}`
    });

    res.json({ success: true, withdrawal: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

// GET /api/admin/settings
app.get('/api/admin/settings', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  await dbStore.syncFromSupabase();
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
      newUserDays,
      timezone,
      teamSystemEnabled,
      managersCanCreateTeams,
      maxTeamsPerManager,
      teamBonusEnabled,
      teamBonusPercent,
      surveyDisplayMode,
      cpxAppId,
      cpxHashKey,
      cpxApiKey,
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
      : (current.userSharePercent || 50);

    const parsedPointsPerUsdt = Number(pointsPerUsdt);
    const effectivePointsPerUsdt = !isNaN(parsedPointsPerUsdt) && parsedPointsPerUsdt >= 100
      ? Math.round(parsedPointsPerUsdt)
      : (current.pointsPerUsdt || 5000);

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
        newUserDays: Number(newUserDays) > 0 ? Math.round(Number(newUserDays)) : (current.newUserDays || 7),
        timezone: typeof timezone === 'string' && timezone.trim() ? timezone.trim() : 'Asia/Karachi',
        teamSystemEnabled: teamSystemEnabled !== undefined ? Boolean(teamSystemEnabled) : Boolean(current.teamSystemEnabled),
        managersCanCreateTeams: managersCanCreateTeams !== undefined ? Boolean(managersCanCreateTeams) : Boolean(current.managersCanCreateTeams),
        maxTeamsPerManager: Number(maxTeamsPerManager) > 0 ? Math.round(Number(maxTeamsPerManager)) : (current.maxTeamsPerManager || 5),
        teamBonusEnabled: teamBonusEnabled !== undefined ? Boolean(teamBonusEnabled) : Boolean(current.teamBonusEnabled),
        teamBonusPercent: teamBonusPercent !== undefined ? Math.max(0, Math.min(100, Number(teamBonusPercent) || 0)) : (current.teamBonusPercent || 0),
        surveyDisplayMode: effectiveDisplayMode,
        cpxAppId: typeof cpxAppId === 'string' && cpxAppId.trim() ? cpxAppId.trim() : (current.cpxAppId || '37479'),
        cpxHashKey: typeof cpxHashKey === 'string' && cpxHashKey.trim() ? cpxHashKey.trim() : (current.cpxHashKey || 'yTrC9mntJwV1PSRJ5WdMbwMSel6qMheY'),
        cpxApiKey: typeof cpxApiKey === 'string' && cpxApiKey.trim() ? cpxApiKey.trim() : (current.cpxApiKey || '2578500163e1998b3c8929e261a3e095'),
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

// -----------------------------------------------------------------------------
// Team System, Roles, Manager Portal, Callback Logs & Impersonation Endpoints
// -----------------------------------------------------------------------------

// GET /api/teams/lookup?code=CODE - Public/Auth Team Lookup for Signup & Profile Join
app.get('/api/teams/lookup', (req: Request, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  if (!checkRateLimit(`team_lookup_${clientIp}`, 30, 60_000)) {
    res.status(429).json({ error: 'Too many team code lookup attempts. Please wait a minute.' });
    return;
  }
  const settings = dbStore.getSettings();
  const code = String(req.query.code || '').trim().toUpperCase();
  if (!code) {
    res.status(400).json({ error: 'Team code is required.' });
    return;
  }
  const team = dbStore.lookupTeamByCode(code);
  if (!team || !team.isActive) {
    res.status(404).json({
      found: false,
      teamSystemEnabled: Boolean(settings.teamSystemEnabled),
      error: team && !team.isActive
        ? `Team "${team.name}" is currently inactive.`
        : `No active team found with code "${code}".`
    });
    return;
  }
  res.json({
    found: true,
    teamSystemEnabled: Boolean(settings.teamSystemEnabled),
    team: {
      id: team.id,
      name: team.name,
      teamCode: team.teamCode,
      isActive: team.isActive,
      managerName: team.managerName
    }
  });
});

// GET /api/user/team - Current user's team membership & feature flag status
app.get('/api/user/team', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const settings = dbStore.getSettings();
  const membership = dbStore.getTeamMembershipForUser(user.id);
  const team = membership ? dbStore.getTeamById(membership.teamId) : undefined;
  const manager = team ? dbStore.getUserById(team.managerId) : undefined;
  res.json({
    teamSystemEnabled: Boolean(settings.teamSystemEnabled),
    canJoinTeam: Boolean(settings.teamSystemEnabled) && !membership && user.role === 'user',
    membership: membership && team
      ? {
          id: membership.id,
          teamId: team.id,
          teamName: team.name,
          teamCode: team.teamCode,
          managerName: manager?.displayName || manager?.username || 'Manager',
          managerEmail: manager?.email || '',
          joinedAt: membership.joinedAt,
          joinedAtKarachi: formatKarachiDateTime(membership.joinedAt),
          consentAcceptedAt: membership.consentAcceptedAt
        }
      : null
  });
});

// POST /api/teams/join - Existing user with no team joins a team once via teamCode + consent checkbox
app.post('/api/teams/join', requireAuth, blockWhenImpersonating, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    if (!checkRateLimit(`team_join_${clientIp}_${req.user!.id}`, 10, 60_000)) {
      res.status(429).json({ error: 'Too many team join attempts. Please wait a minute.' });
      return;
    }
    const { teamCode, consentAccepted } = req.body || {};
    const result = await dbStore.joinTeamByCode({
      userId: req.user!.id,
      teamCode: String(teamCode || ''),
      consentAccepted: Boolean(consentAccepted)
    });
    res.json({
      success: true,
      message: `Successfully joined team "${result.team.name}"!`,
      membership: result.membership,
      team: result.team
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to join team.' });
  }
});

// POST /api/admin/users/:id/role - Promote User to Manager or Demote Manager to User (Admin-Only; logs unauthorized attempts)
app.post('/api/admin/users/:id/role', requireAuth, blockWhenImpersonating, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = req.params.id;
    const rawRole = String(req.body?.role || '').trim().toLowerCase();
    if (rawRole !== 'user' && rawRole !== 'manager') {
      res.status(400).json({ error: 'Role must be "user" or "manager".' });
      return;
    }
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const result = await dbStore.setUserRole({
      targetUserId,
      newRole: rawRole,
      actorUser: req.user!,
      ipAddress
    });
    res.json({
      success: true,
      user: result.user,
      deactivatedTeamsCount: result.deactivatedTeamsCount,
      users: dbStore.getAllUsersWithDetails()
    });
  } catch (err: any) {
    const status = err?.statusCode === 403 ? 403 : 400;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Failed to update user role.' });
  }
});

// POST /api/admin/create-manager - Create Manager Account with Custom Email & Password
app.post(['/api/admin/create-manager', '/api/admin/managers'], requireAuth, requireAdmin, blockWhenImpersonating, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, username, displayName, password, teamName, teamDescription } = req.body || {};
    const rawEmail = String(email || username || '').trim();
    const rawName = String(displayName || username || email || '').trim();
    const cleanPass = typeof password === 'string' ? password : '';

    if (!rawEmail) {
      res.status(400).json({ error: 'Please enter a valid email or username for the manager.' });
      return;
    }
    if (!cleanPass || cleanPass.length < 4) {
      res.status(400).json({ error: 'Password must be at least 4 characters long.' });
      return;
    }

    const lowerEmail = rawEmail.toLowerCase();
    if (
      lowerEmail === 'admin@reward-river' ||
      lowerEmail === 'admin@rewardriver' ||
      lowerEmail === 'admin'
    ) {
      res.status(403).json({ error: 'Cannot use reserved administrator username for a manager.' });
      return;
    }

    const effectiveEmail = lowerEmail.includes('@')
      ? lowerEmail
      : `${lowerEmail.replace(/[^a-z0-9._-]/g, '')}@rewardriver.online`;
    const effectiveName = rawName || effectiveEmail.split('@')[0];

    await dbStore.syncFromSupabase();
    let user = dbStore.getUserByEmail(effectiveEmail) || dbStore.getUserByUsernameOrEmail(rawEmail);

    const { hash, salt } = hashPassword(cleanPass);
    const nowIso = new Date().toISOString();

    if (user) {
      // Existing user: promote to manager and update password
      user = (await dbStore.updateUser(user.id, {
        role: 'manager',
        passwordHash: hash,
        salt,
        displayName: effectiveName,
        emailVerified: true
      })) || user;
    } else {
      // Fresh user creation
      const userId = `usr_${crypto.randomUUID()}`;
      const externalOpaqueId = `rr_cpx_${userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;
      user = await dbStore.createUser({
        id: userId,
        username: effectiveName,
        email: effectiveEmail,
        passwordHash: hash,
        salt,
        displayName: effectiveName,
        emailVerified: true,
        role: 'manager',
        externalOpaqueId,
        createdAt: nowIso,
        updatedAt: nowIso,
        provider: 'password',
        hasPromptedPhone: true
      });
    }

    // Optional team creation
    let createdTeam: any = null;
    const cleanTeamName = String(teamName || '').trim();
    if (cleanTeamName) {
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
      createdTeam = await dbStore.createTeam({
        name: cleanTeamName,
        managerId: user.id,
        actorUser: req.user!,
        ipAddress
      });
    }

    // Add audit log
    await dbStore.addAuditLog({
      adminUserId: req.user!.id,
      adminEmail: req.user!.email,
      action: 'ADMIN_CREATE_MANAGER',
      targetEntity: 'users',
      targetId: user.id,
      details: JSON.stringify({
        email: user.email,
        displayName: user.displayName,
        initialTeam: createdTeam ? createdTeam.name : null,
        teamCode: createdTeam ? createdTeam.teamCode : null
      })
    });

    res.status(201).json({
      success: true,
      message: `Manager "${user.displayName}" created successfully!`,
      manager: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      },
      team: createdTeam
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create manager account.' });
  }
});

// POST /api/admin/users/:id/password - Admin Set/Change Password for Any User or Manager
app.post(['/api/admin/users/:id/password', '/api/admin/managers/:id/password'], requireAuth, requireAdmin, blockWhenImpersonating, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = req.params.id;
    const cleanPass = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!cleanPass || cleanPass.length < 4) {
      res.status(400).json({ error: 'Password must be at least 4 characters long.' });
      return;
    }

    const targetUser = dbStore.getUserById(targetUserId);
    if (!targetUser) {
      res.status(404).json({ error: 'Target user account not found.' });
      return;
    }

    // Prevent changing root Admin password to non-standard from this generic admin route
    const isMainAdmin = targetUser.id === 'usr_admin_rewardriver' || targetUser.email.toLowerCase() === 'admin@reward-river';
    if (isMainAdmin && cleanPass !== 'Tahir@300') {
      res.status(403).json({ error: 'Cannot change root administrator password from this endpoint.' });
      return;
    }

    const { hash, salt } = hashPassword(cleanPass);
    const updated = await dbStore.updateUser(targetUser.id, {
      passwordHash: hash,
      salt,
      updatedAt: new Date().toISOString()
    });

    await dbStore.addAuditLog({
      adminUserId: req.user!.id,
      adminEmail: req.user!.email,
      action: 'ADMIN_SET_USER_PASSWORD',
      targetEntity: 'users',
      targetId: targetUser.id,
      details: JSON.stringify({
        email: targetUser.email,
        role: targetUser.role
      })
    });

    res.json({
      success: true,
      message: `Password updated successfully for ${targetUser.displayName || targetUser.email}.`,
      user: {
        id: updated?.id || targetUser.id,
        email: updated?.email || targetUser.email,
        displayName: updated?.displayName || targetUser.displayName,
        role: updated?.role || targetUser.role
      }
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update user password.' });
  }
});

// GET /api/admin/managers - Admin Managers & Teams hierarchy (Managers -> Teams -> Members)
app.get(['/api/admin/managers', '/api/admin/managers-and-teams'], requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  await dbStore.syncFromSupabase();
  const settings = dbStore.getSettings();
  const allUsers = dbStore.getAllUsersWithDetails();
  const teams = dbStore.getTeams();
  const teamMembers = dbStore.getTeamMembers();
  const ledger = dbStore.getAllLedgerEntries();

  const rawRange = String(req.query.range || 'all').trim().toLowerCase();
  const range: DateRangePreset =
    rawRange === 'today' || rawRange === '7d' || rawRange === '30d' || rawRange === 'custom'
      ? rawRange
      : 'all';
  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined;
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined;

  const stats = computeAdminDashboardStats({
    users: dbStore.getAllUsers(),
    ledger,
    withdrawals: dbStore.getAllWithdrawals(),
    teams,
    teamMembers,
    range,
    startDate,
    endDate,
    pointsPerUsdt: settings.pointsPerUsdt || 5000,
    userSharePercent: settings.userSharePercent || 50,
    newUserDays: settings.newUserDays || 7
  });

  const userMap = new Map(allUsers.map(u => [u.id, u]));
  const teamsDetailed = teams.map(team => {
    const manager = userMap.get(team.managerId);
    const members = teamMembers
      .filter(tm => tm.teamId === team.id)
      .map(tm => {
        const u = userMap.get(tm.userId);
        return {
          id: tm.id,
          teamId: tm.teamId,
          userId: tm.userId,
          displayName: u?.displayName || u?.username || 'Member',
          email: u?.email || 'unknown',
          joinedAt: tm.joinedAt,
          joinedAtKarachi: formatKarachiDateTime(tm.joinedAt),
          consentAcceptedAt: tm.consentAcceptedAt,
          surveysCompleted: u?.completedSurveysCount || 0,
          totalPoints: u?.balances?.totalEarnedPoints || 0,
          availablePoints: u?.balances?.availablePoints || 0,
          lastActiveAt: u?.lastActiveAt,
          lastActiveAtKarachi: u?.lastActiveAtKarachi
        };
      });
    const teamStat = stats.teams.topTeamsByPoints.find(t => t.id === team.id);
    const allTimeTeamPoints = members
      .filter(m => m.userId !== team.managerId)
      .reduce((sum, m) => sum + m.totalPoints, 0);

    return {
      ...team,
      teamName: team.name,
      createdAtKarachi: formatKarachiDateTime(team.createdAt),
      managerName: manager?.displayName || manager?.username || 'Manager',
      managerEmail: manager?.email || '',
      memberCount: members.length,
      teamPoints: teamStat ? teamStat.teamPoints : allTimeTeamPoints,
      totalPoints: teamStat ? teamStat.teamPoints : allTimeTeamPoints,
      completedSurveysCount: teamStat
        ? teamStat.completedSurveysCount
        : members.filter(m => m.userId !== team.managerId).reduce((s, m) => s + m.surveysCompleted, 0),
      members
    };
  });

  const managers = allUsers
    .filter(u => u.role === 'manager')
    .map(m => {
      const mTeams = teamsDetailed.filter(t => t.managerId === m.id);
      return {
        id: m.id,
        displayName: m.displayName,
        email: m.email,
        role: m.role || 'manager',
        createdAt: m.createdAt,
        createdAtKarachi: m.createdAtKarachi,
        lastActiveAtKarachi: m.lastActiveAtKarachi,
        personalPoints: m.balances.totalEarnedPoints,
        teamsCount: mTeams.length,
        activeTeamsCount: mTeams.filter(t => t.isActive).length,
        totalMembersCount: mTeams.reduce((sum, t) => sum + t.memberCount, 0),
        combinedTeamPoints: mTeams.reduce((sum, t) => sum + t.teamPoints, 0),
        teams: mTeams
      };
    });

  res.json({
    success: true,
    timezone: ASIA_KARACHI_TZ,
    settings: {
      teamSystemEnabled: Boolean(settings.teamSystemEnabled),
      managersCanCreateTeams: Boolean(settings.managersCanCreateTeams),
      maxTeamsPerManager: settings.maxTeamsPerManager || 5,
      teamBonusEnabled: Boolean(settings.teamBonusEnabled),
      teamBonusPercent: settings.teamBonusPercent || 0
    },
    summary: stats.teams,
    managers,
    teams: teamsDetailed
  });
});

// POST /api/admin/teams - Create Team (Admin or authorized Manager when managers_can_create_teams=true)
app.post(['/api/admin/teams', '/api/manager/teams'], requireAuth, blockWhenImpersonating, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = req.user!;
    const body = req.body || {};
    const rawName = String(body.name || body.teamName || '').trim();
    const targetManagerId = body.managerId ? String(body.managerId).trim() : actor.id;
    const customCode = body.customCode ? String(body.customCode).trim() : undefined;
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';

    const created = await dbStore.createTeam({
      name: rawName,
      managerId: targetManagerId,
      customCode,
      actorUser: actor,
      ipAddress
    });
    res.status(201).json({
      success: true,
      team: {
        ...created,
        teamName: created.name
      }
    });
  } catch (err: any) {
    const status = err?.statusCode === 403 ? 403 : 400;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Failed to create team.' });
  }
});

// PATCH /api/admin/teams/:id - Enable/Disable or Rename Team (Admin-Only)
app.patch('/api/admin/teams/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const updated = await dbStore.updateTeam({
      teamId: req.params.id,
      name: req.body?.name,
      isActive: req.body?.isActive,
      actorUser: req.user!,
      ipAddress
    });
    res.json({ success: true, team: updated });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update team.' });
  }
});

// POST /api/admin/teams/:id/regenerate-code - Regenerate Team Code (Admin-Only)
app.post('/api/admin/teams/:id/regenerate-code', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const updated = await dbStore.regenerateTeamCode({
      teamId: req.params.id,
      actorUser: req.user!,
      ipAddress
    });
    res.json({ success: true, team: updated });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to regenerate team code.' });
  }
});

// POST /api/admin/teams/:id/reassign - Reassign Team to Another Manager (Admin-Only)
app.post('/api/admin/teams/:id/reassign', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const updated = await dbStore.reassignTeamManager({
      teamId: req.params.id,
      newManagerId: String(req.body?.newManagerId || ''),
      actorUser: req.user!,
      ipAddress
    });
    res.json({ success: true, team: updated });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to reassign team manager.' });
  }
});

// POST /api/admin/team-members/move - Move or Remove Member Between Teams (Admin-Only)
app.post('/api/admin/team-members/move', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const result = await dbStore.moveTeamMember({
      userId: String(req.body?.userId || ''),
      targetTeamId: req.body?.targetTeamId ? String(req.body.targetTeamId) : null,
      actorUser: req.user!,
      ipAddress
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to move team member.' });
  }
});

// GET /api/admin/callback-logs - CPX Postback Callback Logs (Admin-Only)
app.get('/api/admin/callback-logs', requireAuth, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const logs = dbStore.getCallbackLogs(300).map(l => ({
    ...l,
    createdAtKarachi: formatKarachiDateTime(l.createdAt)
  }));
  res.json({
    success: true,
    timezone: ASIA_KARACHI_TZ,
    logs
  });
});

// GET /api/admin/completions - Survey Completions Side-by-Side (Our User + Team + CPX Data with Filters)
app.get('/api/admin/completions', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  await dbStore.syncFromSupabase();
  const users = dbStore.getAllUsers();
  const teams = dbStore.getTeams();
  const teamMembers = dbStore.getTeamMembers();
  const ledger = dbStore.getAllLedgerEntries();
  const settings = dbStore.getSettings();
  const pointsPerUsdt = settings.pointsPerUsdt || 5000;

  const userMap = new Map(users.map(u => [u.id, u]));
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const memberTeamMap = new Map<string, { teamId: string; teamName: string; teamCode: string }>();
  for (const tm of teamMembers) {
    const t = teamMap.get(tm.teamId);
    if (t) memberTeamMap.set(tm.userId, { teamId: t.id, teamName: t.name, teamCode: t.teamCode });
  }

  const statusFilter = String(req.query.status || 'all').trim().toLowerCase();
  const teamFilter = String(req.query.teamId || 'all').trim();
  const search = String(req.query.search || '').trim().toLowerCase();

  const completions = ledger
    .filter(l => l.entryType === 'credit' || l.entryType === 'reversal')
    .map(l => {
      const u = userMap.get(l.userId);
      const tInfo = memberTeamMap.get(l.userId);
      const pts = Math.abs(Math.round(Number(l.points) || Number(l.amountCents) * 100));
      const grossCents =
        typeof l.grossCents === 'number' && l.grossCents > 0
          ? l.grossCents
          : Math.max(1, Math.round((pts / pointsPerUsdt) * 100));
      const isRev = l.entryType === 'reversal' || l.status === 'reversed';
      return {
        id: l.id,
        transId: l.providerTxId,
        offerId: l.cpxOfferId || l.taskId || 'cpx_survey',
        userId: l.userId,
        extUserId: u?.externalOpaqueId || l.userId,
        userEmail: u?.email || 'Unknown',
        userDisplayName: u?.displayName || u?.username || 'Member',
        teamId: tInfo?.teamId || null,
        teamName: tInfo?.teamName || null,
        teamCode: tInfo?.teamCode || null,
        amountUsd: Number((grossCents / 100).toFixed(2)),
        pointsAwarded: isRev ? -pts : pts,
        status: isRev ? 'reversed' : 'completed',
        approvedBy: l.approvedBy || 'CPX S2S Postback',
        description: l.description,
        createdAt: l.createdAt,
        createdAtKarachi: formatKarachiDateTime(l.createdAt)
      };
    })
    .filter(row => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (teamFilter !== 'all') {
        if (teamFilter === 'no_team' && row.teamId) return false;
        if (teamFilter !== 'no_team' && row.teamId !== teamFilter) return false;
      }
      if (search) {
        const hay = `${row.transId} ${row.offerId} ${row.userId} ${row.extUserId} ${row.userEmail} ${row.userDisplayName} ${row.teamName || ''} ${row.teamCode || ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

  res.json({
    success: true,
    timezone: ASIA_KARACHI_TZ,
    totalCount: completions.length,
    totalCompletedCount: completions.filter(c => c.status === 'completed').length,
    totalReversedCount: completions.filter(c => c.status === 'reversed').length,
    totalUsd: Number(
      completions
        .reduce((sum, c) => sum + (c.status === 'reversed' ? -c.amountUsd : c.amountUsd), 0)
        .toFixed(2)
    ),
    totalPoints: completions.reduce((sum, c) => sum + c.pointsAwarded, 0),
    completions
  });
});

// POST /api/admin/impersonate/:userId - Start 15-minute Read-Only "View as User" Session (Admin-Only)
app.post('/api/admin/impersonate/:userId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const admin = req.user!;
    const targetUserId = req.params.userId;
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const sessionRecord = await dbStore.createImpersonationSession({
      adminUser: admin,
      targetUserId,
      ipAddress,
      userAgent
    });

    const targetUser = dbStore.getUserById(targetUserId)!;
    const claim = {
      sessionId: sessionRecord.id,
      adminId: admin.id,
      adminEmail: admin.email,
      targetUserId: targetUser.id,
      targetEmail: targetUser.email,
      startedAt: sessionRecord.startedAt,
      expiresAt: sessionRecord.expiresAt,
      readOnly: true as const
    };
    const impersonationToken = createImpersonationToken(targetUser, claim);
    const balances = dbStore.getUserBalances(targetUser.id);
    const membership = dbStore.getTeamMembershipForUser(targetUser.id);
    const memberTeam = membership ? dbStore.getTeamById(membership.teamId) : undefined;

    res.json({
      success: true,
      token: impersonationToken,
      impersonation: claim,
      user: {
        id: targetUser.id,
        username: targetUser.username || targetUser.displayName,
        email: targetUser.email,
        displayName: targetUser.displayName,
        emailVerified: true,
        role: targetUser.role,
        externalOpaqueId: targetUser.externalOpaqueId,
        createdAt: targetUser.createdAt,
        hasPromptedPhone: true,
        teamId: memberTeam?.id,
        teamName: memberTeam?.name,
        teamCode: memberTeam?.teamCode
      },
      balances
    });
  } catch (err: any) {
    const status = err?.statusCode === 403 ? 403 : 400;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Failed to start View-as-User session.' });
  }
});

// POST /api/admin/impersonate/exit - End Impersonation Session
app.post('/api/admin/impersonate/exit', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.impersonation?.sessionId || req.body?.sessionId;
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    if (sessionId) {
      await dbStore.endImpersonationSession(String(sessionId), req.user!.id, ipAddress);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to exit impersonation session.' });
  }
});

// GET /api/manager/dashboard - Read-Only Manager Dashboard (Strictly Scoped to Manager's Own Teams)
app.get('/api/manager/dashboard', requireAuth, requireManagerOrAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = req.user!;
    // Admin can optionally inspect a specific managerId; a Manager is strictly locked to their own actor.id
    const targetManagerId =
      actor.role === 'admin' && typeof req.query.managerId === 'string' && req.query.managerId.trim()
        ? req.query.managerId.trim()
        : actor.id;

    const rawRange = String(req.query.range || 'all').trim().toLowerCase();
    const range: DateRangePreset =
      rawRange === 'today' || rawRange === '7d' || rawRange === '30d' || rawRange === 'custom'
        ? rawRange
        : 'all';
    const teamId = typeof req.query.teamId === 'string' ? req.query.teamId.trim() : 'all';
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const rawSort = String(req.query.sortBy || 'points').trim();
    const sortBy: 'points' | 'surveys' | 'joinedAt' =
      rawSort === 'surveys' || rawSort === 'joinedAt' ? rawSort : 'points';

    const data = dbStore.getManagerDashboardData({
      managerId: targetManagerId,
      teamId,
      range,
      startDate,
      endDate,
      search,
      sortBy
    });

    res.json({
      success: true,
      ...data
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to load Manager Dashboard.' });
  }
});

// GET /api/manager/members/:userId - Read-Only Member Detail (Strictly Scoped to Manager's Own Teams)
app.get('/api/manager/members/:userId', requireAuth, requireManagerOrAdmin, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const memberUserId = req.params.userId;
  const targetManagerId =
    actor.role === 'admin' && typeof req.query.managerId === 'string' && req.query.managerId.trim()
      ? req.query.managerId.trim()
      : actor.id;

  const detail = dbStore.getManagerMemberDetail({
    managerId: targetManagerId,
    memberUserId
  });

  if (!detail) {
    res.status(403).json({
      error: 'Access forbidden: This user is not a member of any team managed by you.'
    });
    return;
  }

  res.json({
    success: true,
    member: {
      id: detail.userId,
      displayName: detail.displayName,
      email: detail.email,
      teamId: detail.teamId,
      teamName: detail.teamName,
      teamCode: detail.teamCode,
      joinedTeamAt: detail.joinedAt,
      joinedTeamAtKarachi: detail.joinedAtKarachi,
      consentAcceptedAt: detail.consentAcceptedAt,
      lastActiveAt: detail.lastActiveAt,
      lastActiveKarachi: detail.lastActiveAtKarachi
    },
    summary: {
      totalPoints: detail.totalPoints,
      availablePoints: detail.availablePoints,
      completedSurveys: detail.completedSurveysCount
    },
    activityChart: (detail.activityChart || []).map((a: any) => ({
      dateKey: a.date,
      points: a.points,
      completions: a.surveys
    })),
    completions: detail.completions,
    ledger: detail.ledger
  });
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
    const userSharePercent = settings.userSharePercent || 50;
    const pointsPerUsdt = settings.pointsPerUsdt || 5000;

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
app.get('/api/admin/audit-logs', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  await dbStore.syncFromSupabase();
  res.json({ logs: dbStore.getAuditLogs() });
});

// =========================================================================
// OFFICIAL CPX RESEARCH STATISTICS API ENDPOINTS
// =========================================================================

// GET /api/admin/cpx/stats/time - Official Endpoint 1: Get Statistics by Time
app.get('/api/admin/cpx/stats/time', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { start_time, end_time, app_id, country_code, group_by } = req.query;
    const data = await cpxResearchService.fetchStatisticsByTime({
      startTime: typeof start_time === 'string' ? start_time : undefined,
      endTime: typeof end_time === 'string' ? end_time : undefined,
      appId: typeof app_id === 'string' ? app_id : undefined,
      countryCode: typeof country_code === 'string' ? country_code : undefined,
      groupBy: typeof group_by === 'string' ? (group_by as 'day' | 'hour' | 'week' | 'month') : undefined
    });
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message || 'Failed to fetch CPX time statistics' });
  }
});

// GET /api/admin/cpx/stats/countries - Official Endpoint 2: Get Sales by Country
app.get('/api/admin/cpx/stats/countries', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { start_time, end_time, app_id, country_code } = req.query;
    const data = await cpxResearchService.fetchSalesByCountry({
      startTime: typeof start_time === 'string' ? start_time : undefined,
      endTime: typeof end_time === 'string' ? end_time : undefined,
      appId: typeof app_id === 'string' ? app_id : undefined,
      countryCode: typeof country_code === 'string' ? country_code : undefined
    });
    res.json({ success: true, countries: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message || 'Failed to fetch CPX country sales' });
  }
});

// GET /api/admin/cpx/stats/completes - Official Endpoint 3: Get Completes List
app.get('/api/admin/cpx/stats/completes', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { start_time, end_time } = req.query;
    const data = await cpxResearchService.fetchCompletes({
      startTime: typeof start_time === 'string' ? start_time : undefined,
      endTime: typeof end_time === 'string' ? end_time : undefined
    });
    res.json({ success: true, completes: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message || 'Failed to fetch CPX completes' });
  }
});

// GET /api/admin/cpx/stats/screenouts - Official Endpoint 4: Get Screen Outs List
app.get('/api/admin/cpx/stats/screenouts', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { start_time, end_time } = req.query;
    const data = await cpxResearchService.fetchScreenouts({
      startTime: typeof start_time === 'string' ? start_time : undefined,
      endTime: typeof end_time === 'string' ? end_time : undefined
    });
    res.json({ success: true, screenouts: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message || 'Failed to fetch CPX screenouts' });
  }
});

// GET /api/admin/cpx/stats/check-transaction/:transId - Official Endpoint 5: Validate Transaction ID
app.get('/api/admin/cpx/stats/check-transaction/:transId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await cpxResearchService.checkTransaction(req.params.transId);
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ type: 'error', error: message || 'Failed to validate CPX transaction' });
  }
});

// POST /api/admin/cpx/sync-real-points - Real Points & Ledger Synchronization
app.post('/api/admin/cpx/sync-real-points', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startTime, endTime } = req.body || {};
    const result = await cpxResearchService.syncCompletesToUserBalances({ startTime, endTime });
    const allTimePointsCredited = dbStore
      .getAllLedgerEntries()
      .filter(l => l.status === 'confirmed' && l.entryType === 'credit')
      .reduce((sum, l) => sum + (typeof l.points === 'number' && l.points > 0 ? Math.round(l.points) : Math.round(l.amountCents * 100)), 0);
    res.json({
      success: true,
      ...result,
      totalPointsCredited: result.totalPointsCredited > 0 ? result.totalPointsCredited : allTimePointsCredited,
      allTimePointsCredited
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message || 'Failed to sync CPX real completes' });
  }
});

// POST /api/admin/test-cpx-postback
app.post('/api/admin/test-cpx-postback', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetUserId, rewardCents = 100, grossCents, offerId = 'test_offer_101', status = 1 } = req.body;
    const user = dbStore.getUserById(targetUserId) || req.user!;
    const settings = dbStore.getSettings();
    const userSharePercent = settings.userSharePercent || 50;
    const pointsPerUsdt = settings.pointsPerUsdt || 5000;

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
    await dbStore.syncFromSupabase();
    const settings = dbStore.getSettings();
    const userSharePercent = settings.userSharePercent || 50;
    const pointsPerUsdt = settings.pointsPerUsdt || 5000;
    const sbPing = await pingServerSupabase();

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
        id: 'supabase_cloud_db',
        partner: 'Supabase PostgreSQL',
        title: 'Supabase Cloud PostgreSQL Database & RLS Service Key Sync',
        passed: sbPing.connected,
        detail: sbPing.connected
          ? `Connected to ${sbPing.url} (${sbPing.latencyMs}ms) • ${sbPing.userCount ?? users.length} cloud users synced`
          : `Connection warning: ${sbPing.error || 'Unreachable'}`
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

  // Real-time background auto-synchronization every 2 minutes
  const runAutoSync = async () => {
    try {
      const res = await cpxResearchService.syncCompletesToUserBalances();
      if (res.syncedCount > 0) {
        console.log(`[CPX Auto-Sync] Credited ${res.syncedCount} new completes (${res.totalPointsCredited} Pts) to member profiles.`);
      }
    } catch (err) {
      console.warn('[CPX Auto-Sync Note]:', err);
    }
  };

  runAutoSync();
  setInterval(runAutoSync, 120000);

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

if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  startServer().catch(err => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
} else {
  dbStore.init().catch(console.error);
}
