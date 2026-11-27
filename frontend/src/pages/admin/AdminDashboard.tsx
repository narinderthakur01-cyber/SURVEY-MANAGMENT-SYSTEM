import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import api, { apiRequest } from '../../lib/api';
import { User, Role, Team } from '../../types/auth';
import {
  Users,
  Shield,
  CheckCircle2,
  UserX,
  Loader2,
  AlertCircle,
  Plus,
  X,
  UserPlus,
  Briefcase,
  UserCheck,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'USERS' | 'TEAMS'>('USERS');

  const [usersList, setUsersList] = useState<User[]>([]);
  const [rolesList, setRolesList] = useState<Role[]>([]);
  const [teamsList, setTeamsList] = useState<Team[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // User Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRoleId, setNewRoleId] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [userModalError, setUserModalError] = useState<string | null>(null);

  // Team Modal State
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [newTeamSupervisorId, setNewTeamSupervisorId] = useState('');
  const [isSubmittingTeam, setIsSubmittingTeam] = useState(false);
  const [teamModalError, setTeamModalError] = useState<string | null>(null);

  // Add Member State per team
  const [selectedWorkerPerTeam, setSelectedWorkerPerTeam] = useState<{ [teamId: string]: string }>({});
  const [addingMemberTeamId, setAddingMemberTeamId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, rolesData, teamsData] = await Promise.all([
        apiRequest<User[]>('/users'),
        apiRequest<Role[]>('/roles'),
        apiRequest<Team[]>('/teams'),
      ]);
      setUsersList(usersData);
      setRolesList(rolesData);
      setTeamsList(teamsData);
      if (rolesData.length > 0 && !newRoleId) {
        const workerRole = rolesData.find((r) => r.name === 'WORKER') || rolesData[0];
        setNewRoleId(workerRole.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load administrative data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserModalError(null);
    try {
      setIsSubmittingUser(true);
      await api.post('/users', {
        email: newEmail,
        password: newPassword,
        full_name: newFullName,
        role_id: newRoleId,
        phone_number: newPhone.trim() || undefined,
      });
      setIsUserModalOpen(false);
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setNewPhone('');
      await fetchData();
    } catch (err: any) {
      setUserModalError(err.response?.data?.detail || 'Failed to create user account');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamModalError(null);
    try {
      setIsSubmittingTeam(true);
      await api.post('/teams', {
        name: newTeamName,
        description: newTeamDescription.trim() || undefined,
        supervisor_id: newTeamSupervisorId || undefined,
      });
      setIsTeamModalOpen(false);
      setNewTeamName('');
      setNewTeamDescription('');
      setNewTeamSupervisorId('');
      await fetchData();
    } catch (err: any) {
      setTeamModalError(err.response?.data?.detail || 'Failed to create team');
    } finally {
      setIsSubmittingTeam(false);
    }
  };

  const handleAddMemberToTeam = async (teamId: string) => {
    const workerId = selectedWorkerPerTeam[teamId];
    if (!workerId) return;

    try {
      setAddingMemberTeamId(teamId);
      await api.post(`/teams/${teamId}/members`, { user_id: workerId });
      setSelectedWorkerPerTeam((prev) => ({ ...prev, [teamId]: '' }));
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to add member to team');
    } finally {
      setAddingMemberTeamId(null);
    }
  };

  const sortedUsers = [...usersList].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const activeCount = usersList.filter((u) => u.is_active).length;
  const supervisorsList = sortedUsers.filter(
    (u) => u.role?.name === 'SUPERVISOR' || u.role?.name === 'ADMIN'
  );
  const workersList = sortedUsers.filter((u) => u.role?.name === 'WORKER');
  const sortedTeams = [...teamsList].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

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
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Staff</div>
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
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Field Teams</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : teamsList.length}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-slate-50 text-slate-600 rounded-lg">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Field Workers</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : workersList.length}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab('USERS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'USERS'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff Directory ({usersList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TEAMS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'TEAMS'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Field Teams ({teamsList.length})</span>
          </button>
        </div>

        <div>
          {activeTab === 'USERS' ? (
            <button
              type="button"
              onClick={() => setIsUserModalOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              Add Staff User
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsTeamModalOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create Team
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Staff Directory Table */}
      {activeTab === 'USERS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Registered Staff Directory</h2>
              <p className="text-xs text-slate-500">Live records from PostgreSQL database</p>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {usersList.filter((u) => !u.is_active).length > 0
                ? `${usersList.filter((u) => !u.is_active).length} inactive`
                : 'All accounts active'}
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
                    <th className="px-6 py-3">Phone</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedUsers.map((u) => (
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
                      <td className="px-6 py-3.5 text-slate-500">{u.phone_number || '—'}</td>
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
      )}

      {/* Tab 2: Field Teams & Members Management */}
      {activeTab === 'TEAMS' && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-12 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-sky-600 mb-2" />
              Loading teams...
            </div>
          ) : teamsList.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No teams created yet. Click "Create Team" to set up your first field unit.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedTeams.map((t) => (
                <div key={t.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{t.name}</h3>
                      {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                      Active Team
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Assigned Supervisor:</span>
                      <span className="font-semibold text-slate-800 flex items-center">
                        <UserCheck className="w-3.5 h-3.5 mr-1 text-sky-600" />
                        {t.supervisor?.full_name || 'No Supervisor Assigned'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Enrolled Workers:</span>
                      <span className="font-bold text-slate-900">{t.members?.length || 0}</span>
                    </div>
                  </div>

                  {/* Members List */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Team Members ({t.members?.length || 0})
                    </div>
                    {t.members && t.members.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                        {t.members.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium"
                          >
                            <Users className="w-3 h-3 mr-1 text-slate-400" />
                            {m.user?.full_name || 'Field Worker'}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No workers assigned to this team yet.</p>
                    )}
                  </div>

                  {/* Add Worker Inline Control */}
                  <div className="pt-2 border-t border-slate-100 flex items-center space-x-2">
                    <select
                      value={selectedWorkerPerTeam[t.id] || ''}
                      onChange={(e) =>
                        setSelectedWorkerPerTeam((prev) => ({ ...prev, [t.id]: e.target.value }))
                      }
                      className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
                    >
                      <option value="">Select worker to add...</option>
                      {workersList
                        .filter((w) => !t.members?.some((m) => m.user_id === w.id))
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.full_name} ({w.email})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={!selectedWorkerPerTeam[t.id] || addingMemberTeamId === t.id}
                      onClick={() => handleAddMemberToTeam(t.id)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors flex items-center"
                    >
                      {addingMemberTeamId === t.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'Add Worker'
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Create Staff User */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-sky-100 text-sky-700 rounded-lg">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Create Staff User</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {userModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {userModalError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@survey.org"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                <select
                  required
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                >
                  {rolesList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (Optional)</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+1-555-0199"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center"
                >
                  {isSubmittingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Team */}
      {isTeamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Create Field Team</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTeamModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {teamModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {teamModalError}
              </div>
            )}

            <form onSubmit={handleCreateTeam} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Team Name</label>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. North Zone Survey Unit"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                  placeholder="Brief description of field focus or area..."
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Designated Supervisor</label>
                <select
                  value={newTeamSupervisorId}
                  onChange={(e) => setNewTeamSupervisorId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="">Select Supervisor...</option>
                  {supervisorsList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTeamModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTeam}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center"
                >
                  {isSubmittingTeam ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
