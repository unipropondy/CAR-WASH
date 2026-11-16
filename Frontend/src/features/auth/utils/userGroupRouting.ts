import { AuthenticatedUser } from '../../../types/auth.types';

export type UserRoleCategory = 'KIOSK' | 'POS' | 'BACKOFFICE' | 'ADMIN' | 'OWNER' | 'UNKNOWN';

/**
 * Normalizes and determines the user's role category based on their User Group Code and Group Name.
 *
 * Mappings:
 * 1. KIOSK: GRP_004 or name/code containing "KIOSK"
 * 2. POS: GRP_005 or name/code containing "POS"
 * 3. BACK OFFICE: GRP_003 or name/code containing "BACK OFFICE" / "BACKOFFICE"
 * 4. OWNER: code or name containing "OWNER"
 * 5. ADMIN: code or name containing "ADMIN"
 */
export function resolveUserRoleCategory(user?: AuthenticatedUser | null): UserRoleCategory {
  if (!user) return 'UNKNOWN';

  const code = (user.userGroupCode || '').trim().toUpperCase();
  const name = (user.userGroupName || '').trim().toUpperCase();

  // 1. KIOSK (GRP_004)
  if (code === 'GRP_004' || code === 'KIOSK' || name === 'KIOSK' || code.includes('KIOSK') || name.includes('KIOSK')) {
    return 'KIOSK';
  }

  // 2. BACK OFFICE (GRP_003)
  if (
    code === 'GRP_003' ||
    code === 'BACK OFFICE' ||
    code === 'BACKOFFICE' ||
    name === 'BACK OFFICE' ||
    name === 'BACKOFFICE' ||
    code.includes('BACK') ||
    name.includes('BACK')
  ) {
    return 'BACKOFFICE';
  }

  // 3. OWNER
  if (code === 'OWNER' || name === 'OWNER' || code.includes('OWNER') || name.includes('OWNER')) {
    return 'OWNER';
  }

  // 4. POS (GRP_005)
  if (code === 'GRP_005' || code === 'POS' || name === 'POS' || code.includes('POS') || name.includes('POS')) {
    return 'POS';
  }

  // 5. ADMIN
  if (code === 'ADMIN' || name === 'ADMIN' || code.includes('ADMIN') || name.includes('ADMIN')) {
    return 'ADMIN';
  }

  return 'UNKNOWN';
}

/**
 * Centralized redirection helper based on User Group Code.
 *
 * Login Redirection Rules:
 * 1. KIOSK (GRP_004) -> /customer-login (Kiosk UI)
 * 2. POS (GRP_005) -> /dashboard (POS Application)
 * 3. BACK OFFICE (GRP_003) -> /backoffice (Backoffice Dashboard)
 * 4. ADMIN -> /dashboard (POS Application by default)
 * 5. OWNER -> /reports (Sales Report page)
 */
export function getRouteForUserGroup(user?: AuthenticatedUser | null): string {
  const role = resolveUserRoleCategory(user);

  switch (role) {
    case 'KIOSK':
      return '/customer-login';
    case 'BACKOFFICE':
      return '/backoffice';
    case 'OWNER':
      return '/reports';
    case 'POS':
    case 'ADMIN':
    default:
      return '/dashboard';
  }
}
