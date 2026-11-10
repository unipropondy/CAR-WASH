import { LoginResponse } from '../types/auth.types';
import { apiFetch } from './apiConfig';

/**
 * Send user credentials to backend login endpoint
 */
export async function loginUser(userId: string, password: string): Promise<LoginResponse> {
  try {
    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: userId.trim(), password }),
    });

    const data: LoginResponse = await response.json();
    return data;
  } catch (error: any) {
    console.error('[authApi] Login request failed:', error);
    return {
      success: false,
      message: error?.message || 'Unable to connect to the login service. Please ensure the backend server is running.',
    };
  }
}
