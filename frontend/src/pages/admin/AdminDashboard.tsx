import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { apiRequest } from '../../lib/api';
import { User, Role } from '../../types/auth';
import { Users, Shield, CheckCircle2, UserX, Loader2, AlertCircle } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [usersList, setUsersList] = useState<User[]>([]);
  const [rolesList, setRolesList] = useState<Role[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [usersData, rolesData] = await Promise.all([
          apiRequest<User[]>('/users'),
          apiRequest<Role[]>('/roles'),
        ]);
        setUsersList(usersData);
        setRolesList(rolesData);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load administrative data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const activeCount = usersList.filter((u) => u.is_active).length;
  const inactiveCount = usersList.filter((u) => !u.is_active).length;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200 mb-2">
              Organization Control Center
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              Welcome back, {user?.full_name}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              System Administration &bull; Full Organization Access
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
            <span>Role:</span>
            <span className="font-bold text-purple-700">ADMINISTRATOR</span>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Staff Accounts</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : usersList.length}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Staff</div>
            <div className="text-2xl font-bold text-emerald-700 mt-0.5">
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : activeCount}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-slate-50 text-slate-600 rounded-lg">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Configured Roles</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : rolesList.length}
            </div>
          </div>
        </div>
      </div>

      {/* Real Staff Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Registered Staff Directory</h2>
            <p className="text-xs text-slate-500">Live records from PostgreSQL database</p>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {inactiveCount > 0 ? `${inactiveCount} inactive` : 'All accounts active'}
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-sky-600 mb-2" />
            Loading live records from backend...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-6 py-3">Full Name</th>
                  <th className="px-6 py-3">Email Address</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-slate-900">{u.full_name}</td>
                    <td className="px-6 py-3.5 text-slate-600">{u.email}</td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          u.role?.name === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800'
                            : u.role?.name === 'SUPERVISOR'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {u.role?.name || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      {u.is_active ? (
                        <span className="inline-flex items-center text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-rose-700 font-medium">
                          <UserX className="w-3.5 h-3.5 mr-1 text-rose-500" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-slate-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
