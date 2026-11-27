export type TrackingSessionStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'STOPPED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'TERMINATED';

export interface LiveWorkerLocation {
  worker_id: string;
  worker_name: string;
  worker_email: string;
  session_id: string;
  session_status: TrackingSessionStatus;
  task_id: string;
  task_title: string;
  team_id?: string | null;
  team_name?: string | null;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number | null;
  heading?: number | null;
  last_updated: string;
  is_stale: boolean;
}

export interface WorkerLocationPoint {
  id: string;
  session_id: string;
  worker_id: string;
  worker_name?: string | null;
  task_id: string;
  task_title?: string | null;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number | null;
  heading?: number | null;
  recorded_at: string;
}

export interface TrackingSession {
  id: string;
  worker_id: string;
  worker_name?: string | null;
  task_id: string;
  task_title?: string | null;
  status: TrackingSessionStatus;
  consent_granted: boolean;
  started_at: string;
  ended_at?: string | null;
  termination_reason?: string | null;
  device_info?: string | null;
  breadcrumbs_count: number;
  locations?: WorkerLocationPoint[];
}
