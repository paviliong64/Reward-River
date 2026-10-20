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
import { usdtPriceService } from './server/usdtPriceService';
import { usdtPayoutManager } from './server/usdtPayoutService';
import { validateUsdtAddress, calculateUsdtPayout } from './src/utils/usdt';
import { canSubmitWithdrawal } from './src/utils/ledger';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

// -----------------------------------------------------------------------------
// Authentication Endpoints
// -----------------------------------------------------------------------------

// POST /api/auth/register
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, confirmPassword, displayName, acceptTerms } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    if (!acceptTerms) {
      res.status(400).json({ error: 'You must accept the Terms of Service and Privacy Policy to continue.' });
      return;
    }

    const existingUser = dbStore.getUserByEmail(email);
    if (existingUser) {
      res.status(400).json({ error: 'An account with this email address already exists.' });
      return;
    }

    const { hash, salt } = hashPassword(password);
    const userId = `usr_${crypto.randomUUID()}`;
    const externalOpaqueId = `rr_cpx_${crypto.randomBytes(12).toString('hex')}`;

    const newUser: UserAccount = {
      id: userId,
      email: email.trim().toLowerCase(),
      passwordHash: hash,
      salt,
      displayName: displayName?.trim() || email.split('@')[0],
      emailVerified: false,
      role: 'user',
      externalOpaqueId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await dbStore.createUser(newUser);
    const token = createSessionToken(newUser);

    res.status(201).json({
      message: 'Account created successfully. A verification link has been sent to your email.',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
        emailVerified: newUser.emailVerified,
        role: newUser.role,
        createdAt: newUser.createdAt
      }
    });
  } catch (err: unknown) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Please enter both email and password.' });
      return;
    }

    const user = dbStore.getUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = createSessionToken(user);
    const balances = dbStore.getUserBalances(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        role: user.role,
        createdAt: user.createdAt
      },
      balances
    });
  } catch (err: unknown) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const balances = dbStore.getUserBalances(user.id);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      role: user.role,
      createdAt: user.createdAt
    },
    balances
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

  if (!verifyPassword(currentPassword, user.passwordHash, user.salt)) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }

  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    return;
  }

  const { hash, salt } = hashPassword(newPassword);
  await dbStore.updateUser(user.id, { passwordHash: hash, salt });
  res.json({ success: true, message: 'Password updated successfully.' });
});

// POST /api/auth/google-demo
app.post('/api/auth/google-demo', async (req: Request, res: Response) => {
  try {
    const { email, displayName } = req.body;
    const targetEmail = (email || 'user@example.com').trim().toLowerCase();
    
    let user = dbStore.getUserByEmail(targetEmail);
    if (!user) {
      const { hash, salt } = hashPassword(crypto.randomUUID());
      user = {
        id: `usr_${crypto.randomUUID()}`,
        email: targetEmail,
        passwordHash: hash,
        salt,
        displayName: displayName || targetEmail.split('@')[0],
        emailVerified: true,
        role: 'user',
        externalOpaqueId: `rr_cpx_${crypto.randomBytes(12).toString('hex')}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await dbStore.createUser(user);
    }

    const token = createSessionToken(user);
    const balances = dbStore.getUserBalances(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        role: user.role,
        createdAt: user.createdAt
      },
      balances
    });
  } catch {
    res.status(500).json({ error: 'Google sign-in flow failed.' });
  }
});

// -----------------------------------------------------------------------------
// CPX Research API & Survey Marketplace Endpoints
// -----------------------------------------------------------------------------

// GET /api/cpx/status
app.get('/api/cpx/status', (req: Request, res: Response) => {
  const status = cpxResearchService.getConfigStatus();
  res.json(status);
});

// GET /api/surveys
app.get('/api/surveys', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || '';

  const surveyData = await cpxResearchService.fetchEligibleSurveys({
    externalUserId: user.externalOpaqueId,
    ipAddress: clientIp,
    userAgent
  });

  const usdtQuote = await usdtPriceService.getUsdtPriceQuote();

  // Add formatted USDT value to surveys (1:1 USD)
  const surveysWithUsdt = surveyData.surveys.map(s => ({
    ...s,
    rewardUsdtFormatted: `${(s.rewardCents / 100).toFixed(2)} USDT`
  }));

  res.json({
    ...surveyData,
    surveys: surveysWithUsdt,
    usdtQuote
  });
});

// GET /api/surveys/start/:surveyId?
app.get('/api/surveys/start/:surveyId?', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const surveyId = req.params.surveyId;
  const targetUrl = cpxResearchService.generateSurveyStartUrl(user.externalOpaqueId, surveyId);

  res.json({
    success: true,
    url: targetUrl
  });
});

// -----------------------------------------------------------------------------
// CPX Server-to-Server Postback
// -----------------------------------------------------------------------------
app.all('/api/cpx/postback', async (req: Request, res: Response) => {
  const params = req.method === 'POST' ? req.body : req.query;
  const {
    status,
    trans_id,
    ext_user_id,
    user_id,
    amount_local,
    amount_usd,
    offer_id,
    secure_hash,
    hash
  } = params;

  const effectiveUserId = String(ext_user_id || user_id || '').trim();
  const transId = String(trans_id || '').trim();
  const receivedHash = String(secure_hash || hash || '').trim();
  const statusCode = Number(status);

  console.log(`[CPX Postback] Received: trans_id=${transId}, user=${effectiveUserId}, status=${statusCode}, amount=${amount_local}`);

  if (!transId || !effectiveUserId) {
    res.status(400).send('Missing required parameters');
    return;
  }

  const config = cpxResearchService.getConfigStatus();
  if (config.isConfigured && receivedHash) {
    const isValidSig = cpxResearchService.verifyPostback(transId, effectiveUserId, receivedHash);
    if (!isValidSig) {
      res.status(403).send('Invalid signature');
      return;
    }
  }

  const targetUser = dbStore.getUserByExternalId(effectiveUserId);
  if (!targetUser) {
    res.status(200).send('1');
    return;
  }

  const rawReward = Number(amount_local || amount_usd) || 0;
  const rewardCents = Math.round(rawReward * 100);

  if (statusCode === 1) {
    const ledgerEntry = {
      id: `ledg_${crypto.randomUUID()}`,
      userId: targetUser.id,
      providerTxId: transId,
      amountCents: rewardCents > 0 ? rewardCents : 50,
      entryType: 'credit' as const,
      status: 'confirmed' as const,
      description: `Survey Completion (Offer #${offer_id || 'CPX'})`,
      cpxOfferId: String(offer_id || ''),
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString()
    };

    await dbStore.addLedgerEntry(ledgerEntry);
    res.status(200).send('1');
    return;
  }

  if (statusCode === 3) {
    const reversalEntry = {
      id: `ledg_${crypto.randomUUID()}`,
      userId: targetUser.id,
      providerTxId: `${transId}_rev`,
      amountCents: rewardCents > 0 ? rewardCents : 50,
      entryType: 'reversal' as const,
      status: 'confirmed' as const,
      description: `Survey Reversal / Chargeback (Offer #${offer_id || 'CPX'})`,
      reversalRef: transId,
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString()
    };

    await dbStore.addLedgerEntry(reversalEntry);
    res.status(200).send('1');
    return;
  }

  res.status(200).send('1');
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
  const entries = dbStore.getLedgerForUser(user.id);
  const balances = dbStore.getUserBalances(user.id);
  res.json({ entries, balances });
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
app.get('/api/admin/overview', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const users = dbStore.getAllUsers();
  const withdrawals = dbStore.getAllWithdrawals();
  const ledger = dbStore.getAllLedgerEntries();
  const cpxStatus = cpxResearchService.getConfigStatus();
  const payoutStatus = usdtPayoutManager.getStatus();

  const totalRewardsCreditedCents = ledger
    .filter(l => l.status === 'confirmed' && l.entryType === 'credit')
    .reduce((sum, l) => sum + l.amountCents, 0);

  const pendingWithdrawalCount = withdrawals.filter(w => ['requested', 'under_review'].includes(w.status)).length;
  const paidWithdrawalTotalCents = withdrawals
    .filter(w => w.status === 'paid')
    .reduce((sum, w) => sum + w.netCents, 0);

  res.json({
    totalUsers: users.length,
    totalRewardsCreditedCents,
    pendingWithdrawalCount,
    paidWithdrawalTotalUsdt: (paidWithdrawalTotalCents / 100).toFixed(2),
    cpxStatus,
    payoutStatus
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
  const admin = req.user!;
  const { minWithdrawalCents, maxWithdrawalCents, feeCentsTrc20, feeCentsErc20, maintenanceMode, defaultNetwork } = req.body;

  const updated = await dbStore.updateSettings(
    {
      minWithdrawalCents: Number(minWithdrawalCents),
      maxWithdrawalCents: Number(maxWithdrawalCents),
      feeCentsTrc20: Number(feeCentsTrc20),
      feeCentsErc20: Number(feeCentsErc20),
      maintenanceMode: Boolean(maintenanceMode),
      defaultNetwork: defaultNetwork === 'ERC20' ? 'ERC20' : 'TRC20'
    },
    admin.id
  );

  res.json({ success: true, settings: updated });
});

// GET /api/admin/audit-logs
app.get('/api/admin/audit-logs', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  res.json({ logs: dbStore.getAuditLogs() });
});

// POST /api/admin/test-cpx-postback
app.post('/api/admin/test-cpx-postback', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetUserId, rewardCents = 150, offerId = 'test_offer_101', status = 1 } = req.body;
    const user = dbStore.getUserById(targetUserId) || req.user!;
    const transId = `test_cpx_${Date.now()}`;

    const entry = {
      id: `ledg_${crypto.randomUUID()}`,
      userId: user.id,
      providerTxId: transId,
      amountCents: Number(rewardCents),
      entryType: status === 3 ? ('reversal' as const) : ('credit' as const),
      status: 'confirmed' as const,
      description: `Test CPX Postback Event (Offer #${offerId})`,
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
      details: `Simulated CPX Postback: credited ${rewardCents} cents to ${user.email} (transId=${transId})`
    });

    res.json({
      success: result.success,
      entry: result.entry,
      balances: dbStore.getUserBalances(user.id)
    });
  } catch {
    res.status(500).json({ error: 'Failed to simulate CPX postback' });
  }
});

// -----------------------------------------------------------------------------
// Vite Middleware / Static Serve Setup
// -----------------------------------------------------------------------------
async function startServer() {
  await dbStore.init();

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

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
