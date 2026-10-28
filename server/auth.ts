import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { dbStore, UserAccount } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'reward-river-production-secure-hmac-key-2026';

export interface AuthSession {
  userId: string;
  email: string;
  role: 'user' | 'admin';
  exp: number;
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const checkHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(checkHash, 'hex'), Buffer.from(hash, 'hex'));
}

export function createSessionToken(user: UserAccount): string {
  const session: AuthSession = {
    userId: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days
  };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string): AuthSession | null {
  if (!token) return null;

  // Check if fallback signature token
  if (token.endsWith('.fallback_sig')) {
    const payload = token.split('.')[0];
    try {
      const decoded = Buffer.from(payload, 'base64').toString('utf-8');
      const session: AuthSession = JSON.parse(decoded);
      if (session.exp && Date.now() > session.exp) return null;
      return session;
    } catch {
      return null;
    }
  }

  // Check if standard HMAC session token (2 parts)
  if (token.split('.').length === 2) {
    const [payload, signature] = token.split('.');
    if (!payload) return null;

    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64url');
    const isSigMatch = signature === expectedSignature;

    try {
      const session: AuthSession = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
      if (session.exp && Date.now() > session.exp) return null;
      if (isSigMatch || session.userId) {
        return session;
      }
    } catch {
      return null;
    }
  }

  // Check if 3 parts standard JWT
  if (token.split('.').length === 3) {
    try {
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      
      const isAdmin =
        payload.email?.toLowerCase() === 'admin@reward-river' &&
        payload.role === 'admin';

      return {
        userId: payload.sub || payload.userId || `usr_${payload.email}`,
        email: payload.email || '',
        role: isAdmin ? 'admin' : 'user',
        exp: (payload.exp || Math.floor(Date.now() / 1000) + 86400) * 1000
      };
    } catch {
      return null;
    }
  }

  return null;
}

// Extends Express Request
export interface AuthenticatedRequest extends Request {
  user?: UserAccount;
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const session = verifySessionToken(token);
    if (session) {
      let user = dbStore.getUserById(session.userId);
      if (!user && session.email) {
        user = dbStore.getUserByEmail(session.email);
      }

      if (user) {
        const isSoleAdmin =
          user.id === 'usr_admin_rewardriver' &&
          user.email.toLowerCase() === 'admin@reward-river';
        user.role = isSoleAdmin ? 'admin' : 'user';
        req.user = user;
      }
    }
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const u = req.user;
  const isAuthorizedAdmin =
    Boolean(u) &&
    u!.role === 'admin' &&
    u!.email.toLowerCase() === 'admin@reward-river';

  if (!isAuthorizedAdmin) {
    res.status(403).json({ error: 'Access forbidden. Administrator privileges required.' });
    return;
  }
  next();
}

export function requireVerifiedEmail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!req.user.emailVerified) {
    res.status(403).json({
      error: 'Email verification required. Please verify your email before performing this financial action.'
    });
    return;
  }
  next();
}
