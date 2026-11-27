import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Task, TaskCreatePayload, TaskPriority, TaskStatus } from '../../types/task';
import { Survey } from '../../types/survey';
import {
  ClipboardList,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserCheck,
  MapPin,
  Calendar,
  Layers,
  HelpCircle,
  MessageSquare,
  ShieldAlert,
  Loader2,
  X,
  History,
  Send,
  Flag,
} from 'lucide-react';

interface TeamOption {
  id: string;
  name: string;
  supervisor_id?: string;
  members?: Array<{ user: { id: string; full_name: string; email: string } }>;
}

export const AdminTaskManagementPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Create Task Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedSurveyVersionId, setSelectedSurveyVersionId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('MEDIUM');
  const [newDueDate, setNewDueDate] = useState('');
  const [newLocationName, setNewLocationName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Detail / Audit Modal State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Assign / Reassign Modal State
  const [taskToAssign, setTaskToAssign] = useState<Task | null>(null);
  const [reassignWorkerId, setReassignWorkerId] = useState('');
  const [reassignNotes, setReassignNotes] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Assistance Response Modal
  const [respondingAssistanceId, setRespondingAssistanceId] = useState<string | null>(null);
  const [supervisorResponseText, setSupervisorResponseText] = useState('');
  const [isRespondingAssistance, setIsRespondingAssistance] = useState(false);

  // Issue Resolution Modal
  const [resolvingIssueId, setResolvingIssueId] = useState<string | null>(null);
  const [resolutionNotesText, setResolutionNotesText] = useState('');
  const [isResolvingIssue, setIsResolvingIssue] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [tasksRes, surveysRes, teamsRes] = await Promise.all([
        api.get<Task[]>('/tasks'),
        api.get<Survey[]>('/surveys'),
        api.get<TeamOption[]>('/teams'),
      ]);
      setTasks(tasksRes.data);
      setSurveys(surveysRes.data);
      setTeams(teamsRes.data);
    } catch (err: any) {
      console.error('Failed to load tasks and references', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter only published surveys for task creation (strictly enforcing version immutability)
  const publishedSurveys = surveys.filter(
    (s) => s.latest_version && s.latest_version.status === 'PUBLISHED'
  );

  // Eligible team members for selected team
  const activeTeam = teams.find((t) => t.id === selectedTeamId);
  const eligibleTeamWorkers = activeTeam?.members || [];

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !selectedSurveyVersionId) {
      setCreateError('Task title and a published survey version are required');
      return;
    }

    try {
      setIsCreating(true);
      setCreateError(null);

      const payload: TaskCreatePayload = {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        survey_version_id: selectedSurveyVersionId,
        team_id: selectedTeamId || undefined,
        assigned_worker_id: selectedWorkerId || undefined,
        priority: newPriority,
        due_date: newDueDate ? new Date(newDueDate).toISOString() : undefined,
        location_name: newLocationName.trim() || undefined,
      };

      await api.post<Task>('/tasks', payload);
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      setSelectedSurveyVersionId('');
      setSelectedTeamId('');
      setSelectedWorkerId('');
      setNewPriority('MEDIUM');
      setNewDueDate('');
      setNewLocationName('');
      await fetchData();
    } catch (err: any) {
      setCreateError(err.response?.data?.detail || 'Failed to create task');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAssignWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskToAssign || !reassignWorkerId) return;

    try {
      setIsAssigning(true);
      setAssignError(null);
      await api.post<Task>(`/tasks/${taskToAssign.id}/assign`, {
        worker_id: reassignWorkerId,
        notes: reassignNotes.trim() || undefined,
      });
      setTaskToAssign(null);
      setReassignWorkerId('');
      setReassignNotes('');
      await fetchData();
    } catch (err: any) {
      setAssignError(err.response?.data?.detail || 'Failed to assign worker');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCancelTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to cancel this task?')) return;
    try {
      await api.post(`/tasks/${taskId}/cancel`);
      await fetchData();
      if (selectedTask?.id === taskId) {
        setSelectedTask(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to cancel task');
    }
  };

  const handleResolveAssistance = async (taskId: string, reqId: string) => {
    if (!supervisorResponseText.trim()) return;
    try {
      setIsRespondingAssistance(true);
      const res = await api.post<Task>(`/tasks/${taskId}/assistance/${reqId}/resolve`, {
        supervisor_response: supervisorResponseText.trim(),
      });
      setSelectedTask(res.data);
      setRespondingAssistanceId(null);
      setSupervisorResponseText('');
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to resolve assistance request');
    } finally {
      setIsRespondingAssistance(false);
    }
  };

  const handleResolveIssue = async (taskId: string, issueId: string) => {
    if (!resolutionNotesText.trim()) return;
    try {
      setIsResolvingIssue(true);
      const res = await api.post<Task>(`/tasks/${taskId}/issues/${issueId}/resolve`, {
        resolution_notes: resolutionNotesText.trim(),
      });
      setSelectedTask(res.data);
      setResolvingIssueId(null);
      setResolutionNotesText('');
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to resolve task issue');
    } finally {
      setIsResolvingIssue(false);
    }
  };

  // Status Styling Helper
  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'ASSIGNED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ACCEPTED':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'IN_PROGRESS':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'COMPLETED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'REJECTED':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'CANCELLED':
        return 'bg-slate-200 text-slate-600 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'URGENT':
        return 'text-rose-600 bg-rose-50 border-rose-200';
      case 'HIGH':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'MEDIUM':
        return 'text-sky-700 bg-sky-50 border-sky-200';
      case 'LOW':
        return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  // Metrics
  const totalTasks = tasks.length;
  const inProgressTasks = tasks.filter((t) => ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(t.status)).length;
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
  const assistanceRequestsOpen = tasks.reduce(
    (acc, t) => acc + (t.assistance_requests?.filter((a) => a.status === 'OPEN').length || 0),
    0
  );

  // Filter Tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.assigned_worker_name && t.assigned_worker_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.location_name && t.location_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center">
            <ClipboardList className="w-6 h-6 mr-2.5 text-sky-600" />
            Field Task Management
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Coordinate survey assignments, monitor field execution progress, and support workers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsCreateModalOpen(true);
            setCreateError(null);
          }}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Field Task
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Tasks</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalTasks}</p>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-lg">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active in Field</p>
            <p className="text-2xl font-bold text-sky-600 mt-1">{inProgressTasks}</p>
          </div>
          <div className="p-3 bg-sky-50 text-sky-600 rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{completedTasks}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assistance Needed</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{assistanceRequestsOpen}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <HelpCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search tasks, workers, locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Tasks Grid / List */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Loader2 className="w-8 h-8 text-sky-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading task records...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No field tasks found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'ALL'
              ? 'No tasks match the active search and filter conditions.'
              : 'Create a new task to assign field workers to published surveys.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTasks.map((t) => {
            const openAssistance = t.assistance_requests?.filter((a) => a.status === 'OPEN').length || 0;
            const openIssues = t.issues?.filter((i) => i.status === 'OPEN').length || 0;

            return (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5 space-y-3">
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(
                        t.status
                      )}`}
                    >
                      ● {t.status}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getPriorityBadge(
                        t.priority
                      )}`}
                    >
                      {t.priority}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-base line-clamp-1">{t.title}</h3>
                    {t.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.description}</p>
                    )}
                  </div>

                  {/* Survey Info */}
                  <div className="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-semibold truncate max-w-[190px]">
                        📋 {t.survey_title || 'Survey'}
                      </span>
                      <span className="font-mono text-slate-500">v{t.version_number || 1}</span>
                    </div>
                    {t.team_name && (
                      <div className="text-[11px] text-slate-500">Team: {t.team_name}</div>
                    )}
                  </div>

                  {/* Worker & Location Meta */}
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400 mr-2 flex-shrink-0" />
                      <span className="truncate">
                        {t.assigned_worker_name ? (
                          <span className="font-medium text-slate-800">{t.assigned_worker_name}</span>
                        ) : (
                          <span className="text-amber-600 italic">Unassigned</span>
                        )}
                      </span>
                    </div>

                    {t.location_name && (
                      <div className="flex items-center text-slate-500 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mr-2 flex-shrink-0" />
                        <span className="truncate">{t.location_name}</span>
                      </div>
                    )}

                    {t.due_date && (
                      <div className="flex items-center text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 mr-2 flex-shrink-0" />
                        <span>Due: {new Date(t.due_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Alerts & Rejections */}
                  {t.rejection_reason && (
                    <div className="p-2 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-700">
                      <strong>Worker Declined:</strong> {t.rejection_reason}
                    </div>
                  )}

                  {(openAssistance > 0 || openIssues > 0) && (
                    <div className="flex items-center space-x-2 pt-1">
                      {openAssistance > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          {openAssistance} Assistance Req
                        </span>
                      )}
                      {openIssues > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          <ShieldAlert className="w-3 h-3 mr-1" />
                          {openIssues} Issue(s)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedTask(t)}
                    className="font-semibold text-sky-700 hover:text-sky-800 flex items-center"
                  >
                    <History className="w-3.5 h-3.5 mr-1" />
                    Details & Audit
                  </button>

                  <div className="flex items-center space-x-2">
                    {t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && (
                      <button
                        type="button"
                        onClick={() => {
                          setTaskToAssign(t);
                          setReassignWorkerId(t.assigned_worker_id || '');
                          setAssignError(null);
                        }}
                        className="font-semibold text-slate-700 hover:text-slate-900"
                      >
                        {t.assigned_worker_id ? 'Reassign' : 'Assign'}
                      </button>
                    )}

                    {t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && (
                      <button
                        type="button"
                        onClick={() => handleCancelTask(t.id)}
                        className="text-slate-400 hover:text-rose-600"
                        title="Cancel Task"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Field Task */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 my-8 animate-in fade-in zoom-in duration-150">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Create Field Task</h2>
            <p className="text-xs text-slate-500 mb-4">
              Connect a published survey version with a team and assign to a field worker.
            </p>

            {createError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-1.5 flex-shrink-0" />
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ward 14 Household Sanitation Audit"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Published Survey Version <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedSurveyVersionId}
                  onChange={(e) => setSelectedSurveyVersionId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">-- Select a published survey --</option>
                  {publishedSurveys.map((s) => (
                    <option key={s.id} value={s.latest_version?.id}>
                      {s.title} (v{s.latest_version?.version_number} - Published)
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Only immutable published survey versions are allowed.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Team</label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => {
                      setSelectedTeamId(e.target.value);
                      setSelectedWorkerId('');
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">-- No specific team --</option>
                    {teams.map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assign Worker
                  </label>
                  <select
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">-- Assign Later --</option>
                    {eligibleTeamWorkers.map((m) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.full_name} ({m.user.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Location / Address Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sector 4 Community Dispensary"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Instructions</label>
                <textarea
                  rows={2}
                  placeholder="Additional guidance for the field worker..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  {isCreating ? 'Creating Task...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign / Reassign Worker */}
      {taskToAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in duration-150">
            <h2 className="text-lg font-bold text-slate-900 mb-1">
              {taskToAssign.assigned_worker_id ? 'Reassign Task Worker' : 'Assign Field Worker'}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Task: <strong>{taskToAssign.title}</strong>
              {taskToAssign.team_name && <span> (Team: {taskToAssign.team_name})</span>}
            </p>

            {assignError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-1.5 flex-shrink-0" />
                {assignError}
              </div>
            )}

            <form onSubmit={handleAssignWorker} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Field Worker <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={reassignWorkerId}
                  onChange={(e) => setReassignWorkerId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">-- Choose Worker --</option>
                  {(
                    teams.find((tm) => tm.id === taskToAssign.team_id)?.members || []
                  ).map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.full_name} ({m.user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assignment Note / Reason (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes explaining task priority or reassignment reason..."
                  value={reassignNotes}
                  onChange={(e) => setReassignNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTaskToAssign(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  {isAssigning ? 'Updating Assignment...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Task Details & Complete Audit History */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full my-8 p-6 space-y-6 animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(
                      selectedTask.status
                    )}`}
                  >
                    ● {selectedTask.status}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getPriorityBadge(
                      selectedTask.priority
                    )}`}
                  >
                    {selectedTask.priority}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">{selectedTask.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lifecycle Timestamps Timeline */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Lifecycle Milestones
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Created</span>
                  <span className="font-semibold text-slate-700">
                    {new Date(selectedTask.created_at).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Assigned</span>
                  <span className="font-semibold text-slate-700">
                    {selectedTask.assigned_at ? new Date(selectedTask.assigned_at).toLocaleString() : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Started</span>
                  <span className="font-semibold text-slate-700">
                    {selectedTask.started_at ? new Date(selectedTask.started_at).toLocaleString() : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Completed</span>
                  <span className="font-semibold text-slate-700">
                    {selectedTask.completed_at ? new Date(selectedTask.completed_at).toLocaleString() : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Assignment History */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center">
                <History className="w-3.5 h-3.5 mr-1 text-sky-600" />
                Assignment & Reassignment History
              </h4>
              <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-white max-h-48 overflow-y-auto">
                {selectedTask.assignment_history.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No assignment history recorded.</p>
                ) : (
                  selectedTask.assignment_history.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start justify-between text-xs py-2 border-b border-slate-100 last:border-0"
                    >
                      <div>
                        <span className="font-semibold text-slate-800">{a.worker_name || 'Worker'}</span>
                        <span className="text-slate-500 ml-2">by {a.assigned_by_name || 'Supervisor'}</span>
                        {a.notes && <p className="text-slate-500 text-[11px] mt-0.5">"{a.notes}"</p>}
                        {a.rejection_reason && (
                          <p className="text-rose-600 text-[11px] mt-0.5">Reason: {a.rejection_reason}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.status === 'ACCEPTED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : a.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {a.status}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {new Date(a.assigned_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Assistance Requests */}
            {selectedTask.assistance_requests.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center">
                  <MessageSquare className="w-3.5 h-3.5 mr-1 text-amber-600" />
                  Worker Assistance Requests
                </h4>
                <div className="space-y-2.5">
                  {selectedTask.assistance_requests.map((ar) => (
                    <div key={ar.id} className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-900">
                          {ar.worker_name || 'Worker'} requested assistance
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            ar.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-200 text-amber-900'
                          }`}
                        >
                          {ar.status}
                        </span>
                      </div>
                      <p className="text-slate-700 bg-white p-2 rounded border border-amber-100">
                        "{ar.message}"
                      </p>

                      {ar.supervisor_response ? (
                        <div className="p-2 bg-emerald-50 rounded border border-emerald-200 text-emerald-900">
                          <strong>Supervisor Response:</strong> {ar.supervisor_response}
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 pt-1">
                          {respondingAssistanceId === ar.id ? (
                            <div className="w-full space-y-2">
                              <textarea
                                rows={2}
                                value={supervisorResponseText}
                                onChange={(e) => setSupervisorResponseText(e.target.value)}
                                placeholder="Enter your response instructions for the worker..."
                                className="w-full p-2 border border-slate-300 rounded text-xs bg-white"
                              />
                              <div className="flex justify-end space-x-2">
                                <button
                                  type="button"
                                  onClick={() => setRespondingAssistanceId(null)}
                                  className="px-2.5 py-1 text-slate-600 text-xs"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={isRespondingAssistance}
                                  onClick={() => handleResolveAssistance(selectedTask.id, ar.id)}
                                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold"
                                >
                                  Submit Response
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setRespondingAssistanceId(ar.id)}
                              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold flex items-center"
                            >
                              <Send className="w-3 h-3 mr-1" />
                              Respond to Worker
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reported Issues */}
            {selectedTask.issues.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center">
                  <Flag className="w-3.5 h-3.5 mr-1 text-rose-600" />
                  Reported Field Issues
                </h4>
                <div className="space-y-2.5">
                  {selectedTask.issues.map((iss) => (
                    <div key={iss.id} className="p-3 bg-rose-50/60 border border-rose-200 rounded-lg text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-rose-900">
                          {iss.issue_type} • Reported by {iss.reported_by_name || 'Worker'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            iss.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-200 text-rose-900'
                          }`}
                        >
                          {iss.status}
                        </span>
                      </div>
                      <p className="text-slate-700 bg-white p-2 rounded border border-rose-100">
                        {iss.description}
                      </p>

                      {iss.resolution_notes ? (
                        <div className="p-2 bg-emerald-50 rounded border border-emerald-200 text-emerald-900">
                          <strong>Resolution Notes:</strong> {iss.resolution_notes}
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 pt-1">
                          {resolvingIssueId === iss.id ? (
                            <div className="w-full space-y-2">
                              <textarea
                                rows={2}
                                value={resolutionNotesText}
                                onChange={(e) => setResolutionNotesText(e.target.value)}
                                placeholder="Enter action taken to resolve this issue..."
                                className="w-full p-2 border border-slate-300 rounded text-xs bg-white"
                              />
                              <div className="flex justify-end space-x-2">
                                <button
                                  type="button"
                                  onClick={() => setResolvingIssueId(null)}
                                  className="px-2.5 py-1 text-slate-600 text-xs"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={isResolvingIssue}
                                  onClick={() => handleResolveIssue(selectedTask.id, iss.id)}
                                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold"
                                >
                                  Resolve Issue
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setResolvingIssueId(iss.id)}
                              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold"
                            >
                              Mark Resolved
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submitted Survey Data (if Completed) */}
            {selectedTask.survey_response_data && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Submitted Survey Responses
                </h4>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-48 overflow-y-auto">
                  <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap">
                    {JSON.stringify(selectedTask.survey_response_data, null, 2)}
                  </pre>
                  {selectedTask.completion_notes && (
                    <p className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-600">
                      <strong>Worker Notes:</strong> {selectedTask.completion_notes}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
