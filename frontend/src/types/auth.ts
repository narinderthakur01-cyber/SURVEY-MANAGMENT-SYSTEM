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

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  joined_at: string;
  user?: User;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  supervisor_id: string | null;
  supervisor?: User | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  members: TeamMember[];
}

export interface ApiError {
  detail: string | { msg: string; type: string }[];
}
