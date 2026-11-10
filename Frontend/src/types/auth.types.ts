export interface AuthenticatedUser {
  userId: string;
  userCode: string;
  userName: string;
  userGroupId: string;
  userGroupCode: string;
  userGroupName: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  user?: AuthenticatedUser;
  token?: string;
}

