export type Role = 'OWNER' | 'COMPANY_ADMIN' | 'ADDITIONAL';

export interface AuthUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: Role;
  companyId: string | null;
  active: boolean;
  companyActive: boolean;
  passwordHash: string;
  authVersion: number;
}

export interface StoredSession {
  tokenHash: string;
  userId: string;
  authVersion: number;
  expiresAt: Date;
}

export interface CompanyProfile {
  id: string;
  ruc: string;
  legalName: string;
  tradeName: string | null;
  active: boolean;
}

export interface AuthStore {
  findUserByUsername(username: string): Promise<AuthUser | null>;
  findSession(tokenHash: string): Promise<{ session: StoredSession; user: AuthUser } | null>;
  createSession(session: StoredSession): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  getCompany(actor: AuthUser, companyId: string): Promise<CompanyProfile | null>;
}

export function canAccessCompany(actor: AuthUser, companyId: string) {
  return actor.active && (actor.role === 'OWNER' && actor.companyId === null
    || actor.companyActive && actor.companyId === companyId && actor.role !== 'OWNER');
}

export function publicUser(user: AuthUser) {
  return {
    id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName,
    role: user.role, companyId: user.companyId,
  };
}
