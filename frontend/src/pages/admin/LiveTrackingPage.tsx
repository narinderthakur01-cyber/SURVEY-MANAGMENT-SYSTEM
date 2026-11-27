import React, { useEffect, useState, useRef } from 'react';
import api from '../../lib/api';
import { LiveWorkerLocation, WorkerLocationPoint } from '../../types/tracking';
import { useAuthStore } from '../../store/authStore';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Navigation,
  RefreshCw,
  MapPin,
  Clock,
  Radio,
  Layers,
  History,
  X,
  Compass,
} from 'lucide-react';

export const LiveTrackingPage: React.FC = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role?.name === 'ADMIN';

  const [workers, setWorkers] = useState<LiveWorkerLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [historyTrail, setHistoryTrail] = useState<WorkerLocationPoint[]>([]);
  const [isViewingTrail, setIsViewingTrail] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('ALL');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [workerId: string]: L.Marker }>({});
  const polylineRef = useRef<L.Polyline | null>(null);

  const fetchLiveLocations = async (showLoading = false) => {
    try {
      if (showLoading) setIsLoading(true);
      const res = await api.get<LiveWorkerLocation[]>('/tracking/live');
      setWorkers(res.data);
    } catch (err: any) {
      console.error('Failed to fetch live worker locations', err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  // Initial fetch and auto-refresh loop (every 10s)
  useEffect(() => {
    fetchLiveLocations(true);

    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchLiveLocations(false);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [28.6139, 77.2090], // Default center
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Map Markers when workers update
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Filter workers if team filter is set
    const displayedWorkers = workers.filter((w) => {
      if (selectedTeamFilter === 'ALL') return true;
      return w.team_id === selectedTeamFilter;
    });

    // Remove obsolete markers
    const currentWorkerIds = new Set(displayedWorkers.map((w) => w.worker_id));
    Object.keys(markersRef.current).forEach((wId) => {
      if (!currentWorkerIds.has(wId)) {
        markersRef.current[wId].remove();
        delete markersRef.current[wId];
      }
    });

    const latLngBounds: L.LatLngExpression[] = [];

    // Add or update worker markers
    displayedWorkers.forEach((w) => {
      const pos: L.LatLngExpression = [w.latitude, w.longitude];
      latLngBounds.push(pos);

      const isStale = w.is_stale;
      const markerColor = isStale ? '#f59e0b' : '#10b981'; // Amber if stale, Emerald if live
      const pulseHtml = isStale
        ? `<div style="background-color: ${markerColor}; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.3);"></div>`
        : `<div style="position: relative;">
            <div style="background-color: ${markerColor}; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(16,185,129,0.5);"></div>
            <div style="position: absolute; top: -6px; left: -6px; width: 30px; height: 30px; border-radius: 50%; background-color: rgba(16,185,129,0.3); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          </div>`;

      const customIcon = L.divIcon({
        html: pulseHtml,
        className: 'custom-worker-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const popupContent = `
        <div style="font-family: sans-serif; font-size: 12px; min-width: 200px; padding: 2px;">
          <div style="font-weight: bold; font-size: 14px; color: #0f172a; margin-bottom: 2px;">
            ${w.worker_name}
          </div>
          <div style="color: #64748b; font-size: 11px; margin-bottom: 6px;">${w.worker_email}</div>
          <div style="background: #f8fafc; border-radius: 6px; padding: 6px; margin-bottom: 6px;">
            <div style="font-weight: 600; color: #1e293b;">📋 ${w.task_title}</div>
            <div style="color: #64748b; font-size: 11px;">Team: ${w.team_name || 'No Team'}</div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-bottom: 4px;">
            <span>Accuracy: <strong>±${Math.round(w.accuracy)}m</strong></span>
            <span>Speed: <strong>${w.speed ? w.speed.toFixed(1) + ' m/s' : '0 m/s'}</strong></span>
          </div>
          <div style="font-size: 11px; color: ${isStale ? '#b45309' : '#059669'}; font-weight: 600;">
            ${isStale ? '⚠️ Broadcast Stale (>5m ago)' : '● Live Broadcast Active'}
          </div>
          <div style="margin-top: 8px;">
            <button id="trail-btn-${w.worker_id}" style="background: #0284c7; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; width: 100%;">
              View Location Trail
            </button>
          </div>
        </div>
      `;

      if (markersRef.current[w.worker_id]) {
        // Update existing marker
        markersRef.current[w.worker_id].setLatLng(pos);
        markersRef.current[w.worker_id].setIcon(customIcon);
        markersRef.current[w.worker_id].getPopup()?.setContent(popupContent);
      } else {
        // Create new marker
        const marker = L.marker(pos, { icon: customIcon }).addTo(map);
        marker.bindPopup(popupContent);

        // Bind popup open event to attach button listener
        marker.on('popupopen', () => {
          const btn = document.getElementById(`trail-btn-${w.worker_id}`);
          if (btn) {
            btn.onclick = () => handleLoadWorkerTrail(w.worker_id);
          }
        });

        markersRef.current[w.worker_id] = marker;
      }
    });

    // Auto-fit bounds if we have points and not zoomed in on a specific worker
    if (latLngBounds.length > 0 && !selectedWorkerId) {
      map.fitBounds(L.latLngBounds(latLngBounds), { padding: [50, 50], maxZoom: 15 });
    }
  }, [workers, selectedTeamFilter]);

  // Load and draw breadcrumbs trail for a worker
  const handleLoadWorkerTrail = async (workerId: string) => {
    try {
      setSelectedWorkerId(workerId);
      const res = await api.get<WorkerLocationPoint[]>(`/tracking/workers/${workerId}/history?limit=150`);
      setHistoryTrail(res.data);
      setIsViewingTrail(true);

      const map = mapInstanceRef.current;
      if (!map) return;

      // Remove existing polyline if any
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }

      if (res.data.length > 0) {
        const trailPoints: L.LatLngExpression[] = res.data.map((p) => [p.latitude, p.longitude]);
        const polyline = L.polyline(trailPoints, {
          color: '#0284c7',
          weight: 4,
          opacity: 0.8,
          dashArray: '4, 8',
        }).addTo(map);

        polylineRef.current = polyline;
        map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to load location trail');
    }
  };

  const handleClearTrail = () => {
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
    setHistoryTrail([]);
    setIsViewingTrail(false);
  };

  const handleFocusWorker = (w: LiveWorkerLocation) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    setSelectedWorkerId(w.worker_id);
    map.setView([w.latitude, w.longitude], 16, { animate: true });

    const marker = markersRef.current[w.worker_id];
    if (marker) {
      marker.openPopup();
    }
  };

  // Metrics
  const activeCount = workers.filter((w) => !w.is_stale).length;
  const staleCount = workers.filter((w) => w.is_stale).length;
  const uniqueTeams = Array.from(new Set(workers.map((w) => w.team_name).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center">
            <Navigation className="w-6 h-6 mr-2.5 text-sky-600" />
            Live Field Workforce Tracking
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Real-time GPS telemetry and field presence verification &bull;{' '}
            <span className="font-semibold text-slate-700">
              {isAdmin ? 'Full Organization Scope (Admin)' : 'Team-Scoped Access (Supervisor)'}
            </span>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={selectedTeamFilter}
            onChange={(e) => setSelectedTeamFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-2 shadow-sm font-medium text-slate-700"
          >
            <option value="ALL">All Teams</option>
            {Array.from(new Set(workers.map((w) => JSON.stringify({ id: w.team_id, name: w.team_name }))))
              .map((str) => {
                const t = JSON.parse(str);
                if (!t.id) return null;
                return <option key={t.id} value={t.id}>{t.name || 'Unnamed Team'}</option>;
              })}
          </select>

          <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 bg-white px-3 py-2 border border-slate-200 rounded-lg shadow-sm cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
            />
            <span>Auto-Refresh (10s)</span>
          </label>

          <button
            type="button"
            onClick={() => fetchLiveLocations(true)}
            disabled={isLoading}
            className="inline-flex items-center px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Now
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active in Field</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Delayed / Stale</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{staleCount}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Teams</p>
            <p className="text-2xl font-bold text-sky-600 mt-1">{uniqueTeams.length}</p>
          </div>
          <div className="p-3 bg-sky-50 text-sky-600 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Broadcasts</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{workers.length}</p>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-lg">
            <Compass className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Map Workspace (Grid with Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Workers Roster (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
                <MapPin className="w-4 h-4 mr-1.5 text-sky-600" />
                Active Field Roster ({workers.length})
              </h3>
            </div>

            {workers.length === 0 ? (
              <div className="p-6 text-center">
                <Compass className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">No workers currently transmitting GPS coordinates.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Workers must accept an assigned task and consent to location sharing.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {workers.map((w) => {
                  const isSelected = selectedWorkerId === w.worker_id;
                  const isStale = w.is_stale;

                  return (
                    <div
                      key={w.worker_id}
                      onClick={() => handleFocusWorker(w)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all space-y-2 ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50/60 shadow-sm ring-1 ring-sky-500'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{w.worker_name}</span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isStale
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isStale ? '⚠️ Stale' : '● Live'}
                        </span>
                      </div>

                      <div className="text-slate-600 text-[11px]">
                        <div className="font-medium truncate">📋 {w.task_title}</div>
                        {w.team_name && <div className="text-slate-400">Team: {w.team_name}</div>}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                        <span>Accuracy: ±{Math.round(w.accuracy)}m</span>
                        <span>{new Date(w.last_updated).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Breadcrumbs Trail Details (if active) */}
          {isViewingTrail && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-900 flex items-center">
                  <History className="w-3.5 h-3.5 mr-1 text-sky-700" />
                  Trail Route Active
                </span>
                <button
                  type="button"
                  onClick={handleClearTrail}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-sky-800">
                Displaying <strong>{historyTrail.length} recorded breadcrumb points</strong> for this
                worker's tracking session.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Leaflet Map (8 cols) */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-[600px] relative">
            <div ref={mapContainerRef} className="w-full h-full z-0" />
          </div>
        </div>
      </div>
    </div>
  );
};
