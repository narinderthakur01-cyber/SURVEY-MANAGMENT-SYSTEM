import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Task, TaskPriority, TaskStatus } from '../../types/task';
import { useAuthStore } from '../../store/authStore';
import {
  ClipboardCheck,
  Clock,
  Play,
  HelpCircle,
  Flag,
  MapPin,
  Calendar,
  Send,
  Loader2,
  X,
  FileText,
} from 'lucide-react';

export const WorkerTaskDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'ASSIGNED' | 'ACTIVE' | 'COMPLETED'>('ALL');

  // Reject Modal State
  const [rejectingTask, setRejectingTask] = useState<Task | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Assistance Modal State
  const [assistanceTask, setAssistanceTask] = useState<Task | null>(null);
  const [assistanceMessage, setAssistanceMessage] = useState('');
  const [isSendingAssistance, setIsSendingAssistance] = useState(false);

  // Issue Modal State
  const [issueTask, setIssueTask] = useState<Task | null>(null);
  const [issueType, setIssueType] = useState('ACCESS_DENIED');
  const [issueDescription, setIssueDescription] = useState('');
  const [isReportingIssue, setIsReportingIssue] = useState(false);

  // Completed Responses Modal State
  const [viewingResponsesTask, setViewingResponsesTask] = useState<Task | null>(null);

  const fetchWorkerTasks = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<Task[]>('/tasks');
      setTasks(res.data);
    } catch (err: any) {
      console.error('Failed to load worker tasks', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkerTasks();
  }, []);

  const handleAcceptTask = async (taskId: string) => {
    try {
      await api.post(`/tasks/${taskId}/accept`);
      await fetchWorkerTasks();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to accept task');
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingTask || !rejectionReason.trim()) return;

    try {
      setIsRejecting(true);
      await api.post(`/tasks/${rejectingTask.id}/reject`, {
        rejection_reason: rejectionReason.trim(),
      });
      setRejectingTask(null);
      setRejectionReason('');
      await fetchWorkerTasks();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to reject task');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleSendAssistance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assistanceTask || !assistanceMessage.trim()) return;

    try {
      setIsSendingAssistance(true);
      await api.post(`/tasks/${assistanceTask.id}/assistance`, {
        message: assistanceMessage.trim(),
      });
      setAssistanceTask(null);
      setAssistanceMessage('');
      await fetchWorkerTasks();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to send assistance request');
    } finally {
      setIsSendingAssistance(false);
    }
  };

  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueTask || !issueDescription.trim()) return;

    try {
      setIsReportingIssue(true);
      await api.post(`/tasks/${issueTask.id}/issues`, {
        issue_type: issueType,
        description: issueDescription.trim(),
      });
      setIssueTask(null);
      setIssueDescription('');
      await fetchWorkerTasks();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to report issue');
    } finally {
      setIsReportingIssue(false);
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
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
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
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

  const assignedCount = tasks.filter((t) => t.status === 'ASSIGNED').length;
  const activeCount = tasks.filter((t) => ['ACCEPTED', 'IN_PROGRESS'].includes(t.status)).length;
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;

  const filteredTasks = tasks.filter((t) => {
    if (activeTab === 'ASSIGNED') return t.status === 'ASSIGNED';
    if (activeTab === 'ACTIVE') return ['ACCEPTED', 'IN_PROGRESS'].includes(t.status);
    if (activeTab === 'COMPLETED') return t.status === 'COMPLETED';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center">
          <ClipboardCheck className="w-6 h-6 mr-2.5 text-sky-600" />
          Field Worker Portal
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Welcome, {user?.full_name || 'Worker'}. View your assigned surveys, collect data in the
          field, and coordinate with supervisors.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setActiveTab('ASSIGNED')}
          className={`p-5 rounded-xl border shadow-sm cursor-pointer transition-all ${
            activeTab === 'ASSIGNED'
              ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
            Pending Acceptance
          </p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{assignedCount}</p>
        </div>

        <div
          onClick={() => setActiveTab('ACTIVE')}
          className={`p-5 rounded-xl border shadow-sm cursor-pointer transition-all ${
            activeTab === 'ACTIVE'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
            Ready / In Progress
          </p>
          <p className="text-2xl font-bold text-amber-900 mt-1">{activeCount}</p>
        </div>

        <div
          onClick={() => setActiveTab('COMPLETED')}
          className={`p-5 rounded-xl border shadow-sm cursor-pointer transition-all ${
            activeTab === 'COMPLETED'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            Completed Surveys
          </p>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{completedCount}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        {(
          [
            { key: 'ALL', label: `All Tasks (${tasks.length})` },
            { key: 'ASSIGNED', label: `New Assignments (${assignedCount})` },
            { key: 'ACTIVE', label: `In Progress (${activeCount})` },
            { key: 'COMPLETED', label: `Completed (${completedCount})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Loader2 className="w-8 h-8 text-sky-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading your assigned tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No tasks in this view</h3>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === 'ASSIGNED'
              ? 'You have accepted or resolved all new task assignments.'
              : 'No field tasks currently assigned to you in this category.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredTasks.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
            >
              <div className="p-5 space-y-3">
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
                  <h3 className="font-bold text-slate-900 text-base">{t.title}</h3>
                  {t.description && (
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{t.description}</p>
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-800">
                    <span className="font-semibold truncate">📋 {t.survey_title || 'Survey'}</span>
                    <span className="font-mono text-slate-500">v{t.version_number || 1}</span>
                  </div>
                  {t.location_name && (
                    <div className="flex items-center text-slate-500">
                      <MapPin className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                      <span className="truncate">{t.location_name}</span>
                    </div>
                  )}
                  {t.due_date && (
                    <div className="flex items-center text-slate-500">
                      <Calendar className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                      <span>Due: {new Date(t.due_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {/* Supervisor Responses to Worker Assistance */}
                {t.assistance_requests?.map((ar) =>
                  ar.supervisor_response ? (
                    <div
                      key={ar.id}
                      className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900"
                    >
                      <span className="font-bold block mb-0.5">💬 Supervisor Response:</span>
                      {ar.supervisor_response}
                    </div>
                  ) : null
                )}

                {/* Open Assistance Badge */}
                {t.assistance_requests?.some((a) => a.status === 'OPEN') && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                    Assistance requested — waiting for supervisor response.
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                {t.status === 'ASSIGNED' && (
                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => handleAcceptTask(t.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm"
                    >
                      Accept Task
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingTask(t);
                        setRejectionReason('');
                      }}
                      className="px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium rounded-lg"
                    >
                      Decline
                    </button>
                  </div>
                )}

                {t.status === 'ACCEPTED' && (
                  <button
                    type="button"
                    onClick={() => navigate(`/worker/tasks/${t.id}/execute`)}
                    className="inline-flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5" />
                    Start Survey
                  </button>
                )}

                {t.status === 'IN_PROGRESS' && (
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/worker/tasks/${t.id}/execute`)}
                      className="inline-flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 mr-1.5" />
                      Continue Survey
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAssistanceTask(t);
                        setAssistanceMessage('');
                      }}
                      className="p-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700"
                      title="Request Assistance"
                    >
                      <HelpCircle className="w-4 h-4 text-amber-600" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIssueTask(t);
                        setIssueDescription('');
                      }}
                      className="p-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700"
                      title="Report Issue"
                    >
                      <Flag className="w-4 h-4 text-rose-600" />
                    </button>
                  </div>
                )}

                {t.status === 'COMPLETED' && (
                  <button
                    type="button"
                    onClick={() => setViewingResponsesTask(t)}
                    className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1" />
                    View Submission
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Decline / Reject Task */}
      {rejectingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in duration-150">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Decline Task Assignment</h2>
            <p className="text-xs text-slate-500 mb-4">
              Please state why you cannot accept <strong>{rejectingTask.title}</strong> so your
              supervisor can reassign it.
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Rejection <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. In transit on another assignment / Area impassable..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectingTask(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRejecting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  {isRejecting ? 'Submitting...' : 'Confirm Decline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Request Worker Assistance */}
      {assistanceTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in duration-150">
            <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center">
              <HelpCircle className="w-5 h-5 text-amber-600 mr-2" />
              Request Supervisor Assistance
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Task: <strong>{assistanceTask.title}</strong>
            </p>

            <form onSubmit={handleSendAssistance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Describe what assistance you need <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Cannot locate respondent dwelling / Need authorization badge..."
                  value={assistanceMessage}
                  onChange={(e) => setAssistanceMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssistanceTask(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingAssistance}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium disabled:opacity-50 flex items-center"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {isSendingAssistance ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Report Field Issue */}
      {issueTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in duration-150">
            <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center">
              <Flag className="w-5 h-5 text-rose-600 mr-2" />
              Report Field Issue
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Task: <strong>{issueTask.title}</strong>
            </p>

            <form onSubmit={handleReportIssue} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Category</label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-sky-500"
                >
                  <option value="ACCESS_DENIED">Access Denied / Restricted Entry</option>
                  <option value="RESPONDENT_REFUSED">Respondent Refused to Participate</option>
                  <option value="SAFETY_CONCERN">Safety or Weather Hazard</option>
                  <option value="DEVICE_MALFUNCTION">Hardware / GPS Malfunction</option>
                  <option value="OTHER">Other Issue</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Details of the incident or impediment..."
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIssueTask(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReportingIssue}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  {isReportingIssue ? 'Filing Issue...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Completed Responses */}
      {viewingResponsesTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                Survey Responses • {viewingResponsesTask.title}
              </h2>
              <button
                type="button"
                onClick={() => setViewingResponsesTask(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-72 overflow-y-auto">
              <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap">
                {JSON.stringify(viewingResponsesTask.survey_response_data, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingResponsesTask(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
