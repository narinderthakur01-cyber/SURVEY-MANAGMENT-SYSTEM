import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { ClipboardCheck, MapPin, CheckCircle2, ShieldCheck, Clock } from 'lucide-react';

export const WorkerDashboard: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      {/* Worker Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 mb-2">
              Field Worker Portal
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              Welcome, {user?.full_name}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Survey Data Collection &amp; Field Workforce Portal
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
            <span>Role:</span>
            <span className="font-bold text-emerald-700">FIELD WORKER</span>
          </div>
        </div>
      </div>

      {/* Worker Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Account Status</div>
            <div className="text-base font-bold text-emerald-700 mt-0.5 flex items-center">
              Active &bull; Authorized
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-lg">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Location Tracking</div>
            <div className="text-sm font-semibold text-slate-700 mt-0.5">
              Standby (Active Task Only)
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Authentication</div>
            <div className="text-sm font-semibold text-slate-700 mt-0.5">
              JWT Bearer Verified
            </div>
          </div>
        </div>
      </div>

      {/* Task Queue Information */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center space-x-3 mb-4">
          <ClipboardCheck className="w-5 h-5 text-sky-600" />
          <h2 className="text-sm font-bold text-slate-900">Assigned Field Tasks</h2>
        </div>
        <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">No Active Tasks Assigned Yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Task assignment, acceptance, dynamic survey forms, and consent-based location tracking will be enabled in Phases 3, 4, and 6.
          </p>
        </div>
      </div>
    </div>
  );
};
