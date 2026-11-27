import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Task } from '../../types/task';
import { SurveyVersion } from '../../types/survey';
import { SurveyRunner } from '../../components/survey/SurveyRunner';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  MapPin,
  Clock,
} from 'lucide-react';

export const TaskExecutionPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  const [task, setTask] = useState<Task | null>(null);
  const [version, setVersion] = useState<SurveyVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const isInitiatingRef = React.useRef(false);

  useEffect(() => {
    const loadTaskAndSurvey = async () => {
      if (isInitiatingRef.current) return;
      isInitiatingRef.current = true;

      try {
        setIsLoading(true);
        setError(null);

        // 1. Fetch Task
        const taskRes = await api.get<Task>(`/tasks/${taskId}`);
        let t = taskRes.data;
        setTask(t);

        // If task is ACCEPTED, transition it to IN_PROGRESS
        if (t.status === 'ACCEPTED') {
          const startedRes = await api.post<Task>(`/tasks/${taskId}/start`);
          t = startedRes.data;
          setTask(t);
        } else if (t.status === 'COMPLETED') {
          setIsCompleted(true);
        }

        // 2. Fetch Survey Version tree
        const vRes = await api.get<SurveyVersion>(`/surveys/versions/${t.survey_version_id}`);
        setVersion(vRes.data);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load task or survey definition');
      } finally {
        setIsLoading(false);
      }
    };

    if (taskId) {
      loadTaskAndSurvey();
    }
  }, [taskId]);

  const handleSubmitSurvey = async (answers: Record<string, any>) => {
    if (!task) return;

    try {
      setIsSubmitting(true);
      await api.post<Task>(`/tasks/${task.id}/complete`, {
        survey_response_data: answers,
        completion_notes: `Completed by field worker on ${new Date().toLocaleDateString()}`,
      });
      setIsCompleted(true);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit completed task');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || isSubmitting) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-sky-600 animate-spin mb-3" />
        <p className="text-sm text-slate-500 font-medium">
          {isSubmitting ? 'Recording survey responses & completing task...' : 'Preparing field survey form...'}
        </p>
      </div>
    );
  }

  if (error || !task || !version) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-lg mx-auto my-12">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 mb-2">Unable to Load Task</h2>
        <p className="text-xs text-slate-500 mb-4">{error || 'Task details could not be found.'}</p>
        <button
          type="button"
          onClick={() => navigate('/worker')}
          className="inline-flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to My Tasks
        </button>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Task Completed Successfully!</h2>
        <p className="text-xs text-slate-600 max-w-sm mx-auto">
          Survey responses for <strong>{task.title}</strong> have been saved and reported to your
          supervisor.
        </p>
        <div className="pt-4">
          <button
            type="button"
            onClick={() => navigate('/worker')}
            className="inline-flex items-center px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to My Tasks Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Navigation & Task Meta Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/worker')}
            className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Save & Exit to Tasks
          </button>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            ● In Progress
          </span>
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">{task.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
            <span className="font-medium text-slate-700">
              📋 {version.survey_title || task.survey_title || 'Survey'} (v{version.version_number})
            </span>
            {task.location_name && (
              <span className="flex items-center">
                <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                {task.location_name}
              </span>
            )}
            {task.due_date && (
              <span className="flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Due: {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {task.description && (
          <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <strong>Supervisor Instructions:</strong> {task.description}
          </p>
        )}
      </div>

      {/* Survey Runner Embed */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <SurveyRunner
          version={version}
          previewMode={false}
          onSubmitSuccess={handleSubmitSurvey}
        />
      </div>
    </div>
  );
};
