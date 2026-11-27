export type TaskStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TaskAssignment {
  id: string;
  task_id: string;
  worker_id: string;
  worker_name?: string | null;
  assigned_by_id: string;
  assigned_by_name?: string | null;
  assigned_at: string;
  status: string;
  rejection_reason?: string | null;
  notes?: string | null;
}

export interface TaskAssistanceRequest {
  id: string;
  task_id: string;
  worker_id: string;
  worker_name?: string | null;
  message: string;
  status: 'OPEN' | 'RESOLVED';
  supervisor_response?: string | null;
  resolved_by_id?: string | null;
  resolved_by_name?: string | null;
  created_at: string;
  resolved_at?: string | null;
}

export interface TaskIssue {
  id: string;
  task_id: string;
  reported_by_id: string;
  reported_by_name?: string | null;
  issue_type: string;
  description: string;
  status: 'OPEN' | 'RESOLVED';
  resolution_notes?: string | null;
  created_at: string;
  resolved_at?: string | null;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  survey_version_id: string;
  survey_title?: string | null;
  version_number?: number | null;
  team_id?: string | null;
  team_name?: string | null;
  assigned_worker_id?: string | null;
  assigned_worker_name?: string | null;
  created_by_id: string;
  creator_name?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  location_name?: string | null;
  target_latitude?: number | null;
  target_longitude?: number | null;
  created_at: string;
  assigned_at?: string | null;
  accepted_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  rejection_reason?: string | null;
  completion_notes?: string | null;
  survey_response_data?: Record<string, any> | null;
  updated_at: string;
  assignment_history: TaskAssignment[];
  assistance_requests: TaskAssistanceRequest[];
  issues: TaskIssue[];
}

export interface TaskCreatePayload {
  title: string;
  description?: string;
  survey_version_id: string;
  team_id?: string;
  assigned_worker_id?: string;
  priority: TaskPriority;
  due_date?: string;
  location_name?: string;
  target_latitude?: number;
  target_longitude?: number;
}
