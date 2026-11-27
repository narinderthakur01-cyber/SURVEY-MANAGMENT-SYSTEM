export type RoleName = 'ADMIN' | 'SUPERVISOR' | 'WORKER';

export interface Role {
  id: string;
  name: RoleName;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone_number: string | null;
  role_id: string;
  role?: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface ApiError {
  detail: string | { msg: string; type: string }[];
}
