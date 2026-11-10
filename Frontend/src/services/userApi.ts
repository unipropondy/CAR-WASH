import { getApiBaseUrl, apiFetch } from './apiConfig';

export interface UserRecord {
  userId: string;
  userCode: string;
  userName: string;
  fullName: string;
  userGroupId: string | null;
  userGroupCode: string;
  userGroupName: string;
  groupIsActive: boolean;
  isDisabled: boolean;
  createdBy?: string;
  createdOn?: string;
  modifiedBy?: string;
  modifiedOn?: string;
  lastLoginDate?: string;
}

export interface UserGroupRecord {
  userGroupId: string;
  userGroupCode: string;
  userGroupName: string;
  isActive: boolean;
}

export interface CreateUserPayload {
  userCode: string;
  userName: string;
  password: string;
  userGroupId?: string;
  fullName?: string;
  isDisabled?: boolean;
  createdBy?: string;
}

export interface UpdateUserPayload {
  userName?: string;
  password?: string;
  userGroupId?: string;
  fullName?: string;
  isDisabled?: boolean;
  modifiedBy?: string;
}

/**
 * Fetch all users from MSSQL dbo.UserMaster
 */
export async function fetchUsers(search?: string): Promise<UserRecord[]> {
  const url = search ? `/api/users?search=${encodeURIComponent(search)}` : '/api/users';
  const res = await apiFetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch users');
  }
  const data = await res.json();
  return data.data || [];
}

/**
 * Fetch all active user groups from MSSQL dbo.UserGroupMaster
 */
export async function fetchUserGroups(): Promise<UserGroupRecord[]> {
  const res = await apiFetch('/api/users/groups');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch user groups');
  }
  const data = await res.json();
  return data.data || [];
}

/**
 * Create a new user in MSSQL dbo.UserMaster
 */
export async function createUser(payload: CreateUserPayload): Promise<any> {
  const res = await apiFetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to create user');
  }
  return data.data;
}

/**
 * Update an existing user in MSSQL dbo.UserMaster
 */
export async function updateUser(userId: string, payload: UpdateUserPayload): Promise<any> {
  const res = await apiFetch(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to update user');
  }
  return data.data;
}

/**
 * Delete or deactivate user in MSSQL dbo.UserMaster
 */
export async function deleteUser(userId: string, permanent: boolean = false): Promise<any> {
  const url = `/api/users/${encodeURIComponent(userId)}${permanent ? '?permanent=true' : ''}`;
  const res = await apiFetch(url, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to delete/deactivate user');
  }
  return data;
}

