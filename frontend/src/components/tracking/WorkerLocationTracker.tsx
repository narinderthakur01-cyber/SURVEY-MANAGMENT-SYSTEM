import React, { useState, useEffect, useRef } from 'react';
import api from '../../lib/api';
import { TrackingSession, WorkerLocationPoint } from '../../types/tracking';
import {
  MapPin,
  Shield,
  Activity,
  AlertTriangle,
  Square,
  Navigation,
  Radio,
  Lock,
} from 'lucide-react';

interface WorkerLocationTrackerProps {
  taskId: string;
  taskTitle: string;
  taskStatus: string;
  onSessionStateChange?: (isActive: boolean) => void;
}

export const WorkerLocationTracker: React.FC<WorkerLocationTrackerProps> = ({
  taskId,
  taskTitle,
  taskStatus,
  onSessionStateChange,
}) => {
  const [activeSession, setActiveSession] = useState<TrackingSession | null>(null);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [hasAgreedToConsent, setHasAgreedToConsent] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [lastRecorded, setLastRecorded] = useState<WorkerLocationPoint | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<'PROMPT' | 'GRANTED' | 'DENIED' | 'UNSUPPORTED'>('PROMPT');
  const [lastUpdateAgo, setLastUpdateAgo] = useState<string>('Never');

  const watchIdRef = useRef<number | null>(null);
  const intervalTimerRef = useRef<number | null>(null);

  // Check browser Geolocation support
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setPermissionState('UNSUPPORTED');
      setErrorStatus('Geolocation API is not supported by your browser.');
    } else if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((res) => {
        if (res.state === 'granted') setPermissionState('GRANTED');
        else if (res.state === 'denied') setPermissionState('DENIED');
        else setPermissionState('PROMPT');

        res.onchange = () => {
          if (res.state === 'granted') setPermissionState('GRANTED');
          else if (res.state === 'denied') setPermissionState('DENIED');
          else setPermissionState('PROMPT');
        };
      });
    }
  }, []);

  // Update timer label
  useEffect(() => {
    const timer = setInterval(() => {
      if (lastRecorded) {
        const sec = Math.round((Date.now() - new Date(lastRecorded.recorded_at).getTime()) / 1000);
        if (sec < 5) setLastUpdateAgo('Just now');
        else if (sec < 60) setLastUpdateAgo(`${sec}s ago`);
        else setLastUpdateAgo(`${Math.round(sec / 60)}m ago`);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [lastRecorded]);

  // Handle live coordinate sending
  const sendLocationUpdate = (pos: GeolocationPosition) => {
    if (!activeSession || activeSession.status !== 'ACTIVE') return;

    const payload = {
      session_id: activeSession.id,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      speed: pos.coords.speed !== null && pos.coords.speed >= 0 ? pos.coords.speed : undefined,
      heading: pos.coords.heading !== null && pos.coords.heading >= 0 ? pos.coords.heading : undefined,
      recorded_at: new Date(pos.timestamp).toISOString(),
    };

    api.post<WorkerLocationPoint>('/tracking/locations', payload)
      .then((res) => {
        setLastRecorded(res.data);
        setErrorStatus(null);
      })
      .catch((err) => {
        console.warn('Failed to record location update:', err.response?.data?.detail || err.message);
      });
  };

  const handleGeolocationError = (err: GeolocationPositionError) => {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        setPermissionState('DENIED');
        setErrorStatus('Location permission was denied. Please allow location access in your browser settings.');
        break;
      case err.POSITION_UNAVAILABLE:
        setErrorStatus('GPS position is currently unavailable. Waiting for GPS fix...');
        break;
      case err.TIMEOUT:
        setErrorStatus('GPS signal request timed out. Re-acquiring position...');
        break;
      default:
        setErrorStatus(`GPS error: ${err.message}`);
    }
  };

  // Start watching position when session is active
  useEffect(() => {
    if (activeSession && activeSession.status === 'ACTIVE' && navigator.geolocation) {
      // 1. Initial immediate capture
      navigator.geolocation.getCurrentPosition(sendLocationUpdate, handleGeolocationError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      });

      // 2. Periodic periodic sync interval (every 10 seconds)
      intervalTimerRef.current = window.setInterval(() => {
        navigator.geolocation.getCurrentPosition(sendLocationUpdate, handleGeolocationError, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 10000,
        });
      }, 10000);

      if (onSessionStateChange) onSessionStateChange(true);
    } else {
      if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (onSessionStateChange) onSessionStateChange(false);
    }

    return () => {
      if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [activeSession]);

  const handleStartTracking = async () => {
    try {
      setIsStarting(true);
      setErrorStatus(null);
      const res = await api.post<TrackingSession>('/tracking/sessions/start', {
        task_id: taskId,
        consent_granted: true,
        device_info: `${navigator.userAgent} (${navigator.platform || 'Unknown Platform'})`,
      });
      setActiveSession(res.data);
      setIsConsentModalOpen(false);
    } catch (err: any) {
      setErrorStatus(err.response?.data?.detail || 'Failed to start tracking session');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopTracking = async () => {
    if (!activeSession) return;
    try {
      setIsStopping(true);
      const res = await api.post<TrackingSession>(`/tracking/sessions/${activeSession.id}/stop`, {
        termination_reason: 'WORKER_STOPPED',
      });
      setActiveSession(res.data);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to stop tracking');
    } finally {
      setIsStopping(false);
    }
  };

  const isTaskEligible = ['ACCEPTED', 'IN_PROGRESS'].includes(taskStatus);
  const isTracking = activeSession?.status === 'ACTIVE';

  if (!isTaskEligible) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header Bar */}
      <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-sky-600" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Live Field Location Tracking
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {isTracking ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping mr-1.5" />
              Live Sharing Active
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-slate-500 bg-slate-100">
              Tracking Inactive
            </span>
          )}
        </div>
      </div>

      {/* Body Content */}
      <div className="p-5 space-y-4">
        {permissionState === 'DENIED' && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Browser Location Access Denied</p>
              <p className="mt-0.5">Please allow location access in your browser address bar to share GPS coordinates.</p>
            </div>
          </div>
        )}

        {errorStatus && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">GPS Tracking Notice</p>
              <p className="mt-0.5">{errorStatus}</p>
            </div>
          </div>
        )}

        {isTracking ? (
          <div className="space-y-4">
            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px] flex items-center">
                  <MapPin className="w-3 h-3 mr-1" />
                  Coordinates
                </span>
                <span className="font-mono font-semibold text-slate-800 text-[11px] truncate block mt-0.5">
                  {lastRecorded
                    ? `${lastRecorded.latitude.toFixed(5)}, ${lastRecorded.longitude.toFixed(5)}`
                    : 'Acquiring GPS...'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] flex items-center">
                  <Radio className="w-3 h-3 mr-1" />
                  Accuracy
                </span>
                <span
                  className={`font-semibold block mt-0.5 ${
                    lastRecorded
                      ? lastRecorded.accuracy <= 20
                        ? 'text-emerald-600'
                        : lastRecorded.accuracy <= 50
                        ? 'text-amber-600'
                        : 'text-rose-600'
                      : 'text-slate-600'
                  }`}
                >
                  {lastRecorded ? `±${Math.round(lastRecorded.accuracy)} m` : '—'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] flex items-center">
                  <Activity className="w-3 h-3 mr-1" />
                  Last Broadcast
                </span>
                <span className="font-semibold text-slate-700 block mt-0.5">
                  {lastUpdateAgo}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] flex items-center">
                  <Lock className="w-3 h-3 mr-1" />
                  Session State
                </span>
                <span className="font-semibold text-emerald-700 block mt-0.5">
                  Consent Verified
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-500 text-[11px]">
                Your supervisor can view your verified coordinates on the live tracking map while this
                task is active.
              </span>
              <button
                type="button"
                onClick={handleStopTracking}
                disabled={isStopping}
                className="inline-flex items-center px-3.5 py-1.5 border border-rose-300 hover:bg-rose-50 text-rose-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Square className="w-3.5 h-3.5 mr-1.5 fill-current" />
                {isStopping ? 'Stopping...' : 'Stop Tracking'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sky-50/60 border border-sky-200 p-4 rounded-xl">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-sky-950 flex items-center">
                <Navigation className="w-4 h-4 mr-1.5 text-sky-600" />
                Location Sharing for "{taskTitle}"
              </h4>
              <p className="text-[11px] text-sky-800 max-w-lg leading-relaxed">
                Enable live GPS sharing to help your supervisor verify field presence, monitor route
                safety, and provide coordinates for emergency assistance.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsConsentModalOpen(true)}
              className="inline-flex items-center justify-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              <MapPin className="w-3.5 h-3.5 mr-1.5" />
              Start Live Tracking
            </button>
          </div>
        )}
      </div>

      {/* Modal: Explicit Worker Consent Dialog */}
      {isConsentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100">
              <div className="p-2 bg-sky-100 text-sky-700 rounded-lg">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Location Sharing Consent Agreement
                </h3>
                <p className="text-xs text-slate-500">Task: {taskTitle}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p>
                <strong>Why your location is collected:</strong> Your GPS coordinates are transmitted
                periodically to your designated team supervisor to confirm on-site progress, ensure
                worker physical safety, and coordinate logistics.
              </p>
              <p>
                <strong>Privacy guarantees:</strong>
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-500">
                <li>Tracking is only active while performing this assigned task.</li>
                <li>You may stop tracking at any point by clicking "Stop Tracking".</li>
                <li>Tracking automatically terminates when the task is marked Complete.</li>
                <li>
                  Location history is strictly stored with a 30-day retention policy and accessible only
                  by authorized supervisors.
                </li>
              </ul>
            </div>

            <label className="flex items-start space-x-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={hasAgreedToConsent}
                onChange={(e) => setHasAgreedToConsent(e.target.checked)}
                className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 mt-0.5"
              />
              <span className="text-xs font-semibold text-slate-800">
                I understand and give explicit consent for my device location to be recorded while
                completing this field task assignment.
              </span>
            </label>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsConsentModalOpen(false);
                  setHasAgreedToConsent(false);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!hasAgreedToConsent || isStarting}
                onClick={handleStartTracking}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center"
              >
                {isStarting ? 'Initiating Tracking...' : 'Consent & Begin Tracking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
