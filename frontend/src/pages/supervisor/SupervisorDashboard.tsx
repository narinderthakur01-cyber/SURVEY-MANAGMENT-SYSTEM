import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { apiRequest } from '../../lib/api';
import { Users, Shield, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface TeamMember {
  id: string;
  user_id: string;
  user?: {
    full_name: string;
    email: string;
    phone_number: string | null;
  };
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  members: TeamMember[];
}

export const SupervisorDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<Team[]>('/teams');
        setTeams(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to fetch supervised teams');
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, []);

  const totalWorkers = teams.reduce((acc, t) => acc + (t.members?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200 mb-2">
              Supervisor Portal
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              Welcome back, {user?.full_name}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Field Team Coordination &bull; Authorized Teams & Workers Only
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
            <span>Role:</span>
            <span className="font-bold text-sky-700">SUPERVISOR</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-lg">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Authorized Teams</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : teams.length}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Assigned Field Workers</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : totalWorkers}
            </div>
          </div>
        </div>
      </div>

      {/* Teams Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-900 mb-1">Supervised Field Teams</h2>
        <p className="text-xs text-slate-500 mb-5">
          Backend authorization ensures you only view teams specifically assigned to your supervisor account.
        </p>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-sky-600 mb-2" />
            Loading assigned teams...
          </div>
        ) : teams.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-300">
            No active teams assigned to your supervisor profile yet. Contact an administrator to assign teams.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map((team) => (
              <div key={team.id} className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-sm text-slate-900">{team.name}</h3>
                    <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">{team.description || 'No description provided.'}</p>
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <div className="text-[11px] font-semibold text-slate-600 mb-2">
                    Team Members ({team.members?.length || 0})
                  </div>
                  {team.members && team.members.length > 0 ? (
                    <ul className="space-y-1.5">
                      {team.members.map((m) => (
                        <li key={m.id} className="text-xs text-slate-700 flex justify-between items-center bg-white p-2 rounded border border-slate-200/80">
                          <span className="font-medium">{m.user?.full_name || 'Worker'}</span>
                          <span className="text-slate-400 text-[10px]">{m.user?.email}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">No workers assigned to this team yet.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
