import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Survey, SurveyPublicLink } from '../../types/survey';
import { useAuthStore } from '../../store/authStore';
import {
  FileText,
  Plus,
  Search,
  ExternalLink,
  Edit3,
  Copy,
  Check,
  Globe,
  Loader2,
  Calendar,
  Layers,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

export const SurveyListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role?.name === 'ADMIN';

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');

  // New survey modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Public link modal state
  const [selectedSurveyForLink, setSelectedSurveyForLink] = useState<Survey | null>(null);
  const [customSlug, setCustomSlug] = useState('');
  const [publicLinkResult, setPublicLinkResult] = useState<SurveyPublicLink | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchSurveys = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<Survey[]>('/surveys');
      setSurveys(res.data);
    } catch (err: any) {
      console.error('Failed to fetch surveys', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSurveys();
  }, []);

  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setCreateError('Survey title is required');
      return;
    }

    try {
      setIsCreating(true);
      setCreateError(null);
      const res = await api.post<Survey>('/surveys', {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
      });

      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      // Navigate to the dynamic survey builder
      navigate(`/admin/surveys/${res.data.id}/builder`);
    } catch (err: any) {
      setCreateError(err.response?.data?.detail || 'Failed to create survey');
    } finally {
      setIsCreating(false);
    }
  };

  const handleGeneratePublicLink = async () => {
    if (!selectedSurveyForLink?.latest_version) return;

    try {
      setIsGeneratingLink(true);
      setLinkError(null);
      const versionId = selectedSurveyForLink.latest_version.id;
      const res = await api.post<SurveyPublicLink>(`/surveys/versions/${versionId}/public-link`, {
        version_id: versionId,
        custom_slug: customSlug.trim() || undefined,
      });
      setPublicLinkResult(res.data);
    } catch (err: any) {
      setLinkError(err.response?.data?.detail || 'Failed to generate public link');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyToClipboard = (slug: string) => {
    const fullUrl = `${window.location.origin}/s/${slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredSurveys = surveys.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const latestStatus = s.latest_version?.status || (s.versions[0]?.status as any);
    const matchesStatus =
      filterStatus === 'ALL' ||
      (filterStatus === 'PUBLISHED' && latestStatus === 'PUBLISHED') ||
      (filterStatus === 'DRAFT' && latestStatus === 'DRAFT');

    return matchesSearch && matchesStatus;
  });

  const publishedCount = surveys.filter((s) => s.latest_version?.status === 'PUBLISHED' || s.versions[0]?.status === 'PUBLISHED').length;
  const draftCount = surveys.length - publishedCount;

  return (
    <div className="space-y-6">
      {/* Header and Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center">
            <FileText className="w-6 h-6 mr-2.5 text-sky-600" />
            Survey Management
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Design dynamic survey forms, manage immutable versions, and distribute respondent links.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Survey
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Surveys</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{surveys.length}</p>
          </div>
          <div className="p-3 bg-sky-50 text-sky-600 rounded-lg">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Published & Active</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{publishedCount}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Draft Versions</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{draftCount}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Edit3 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search surveys..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs font-medium text-slate-500">Status:</span>
          {(['ALL', 'PUBLISHED', 'DRAFT'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === status
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Survey List */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Loader2 className="w-8 h-8 text-sky-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading surveys...</p>
        </div>
      ) : filteredSurveys.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No surveys found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'No surveys match your search query.'
              : 'Get started by creating your first survey and configuring dynamic questions.'}
          </p>
          {isAdmin && !searchQuery && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 inline-flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium rounded-lg shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Create Survey Now
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSurveys.map((survey) => {
            const latestV = survey.latest_version || survey.versions[0];
            const isPublished = latestV?.status === 'PUBLISHED';
            const versionNum = latestV?.version_number || 1;

            return (
              <div
                key={survey.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isPublished
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {isPublished ? '● Published' : '○ Draft'}
                    </span>
                    <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      v{versionNum}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base line-clamp-1">{survey.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 min-h-[32px]">
                    {survey.description || 'No description provided.'}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1" />
                      {new Date(survey.created_at).toLocaleDateString()}
                    </span>
                    <span>{survey.versions?.length || 1} version(s)</span>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/surveys/${survey.id}/builder`)}
                      className="inline-flex items-center text-xs font-semibold text-sky-700 hover:text-sky-800"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1" />
                      Open Builder
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">View Only</span>
                  )}

                  {isPublished && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSurveyForLink(survey);
                        setPublicLinkResult(null);
                        setLinkError(null);
                        setCustomSlug('');
                      }}
                      className="inline-flex items-center text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                    >
                      <Globe className="w-3.5 h-3.5 mr-1" />
                      Public Link
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Survey */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in duration-150">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Create New Survey</h2>
            <p className="text-xs text-slate-500 mb-4">
              Enter basic metadata. You will be redirected to the visual builder to add sections and questions.
            </p>

            {createError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1.5 flex-shrink-0" />
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSurvey} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Survey Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Household Sanitation Assessment"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Brief context or instructions for respondents..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
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
                  {isCreating ? 'Creating...' : 'Continue to Builder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Public Respondent Link */}
      {selectedSurveyForLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in duration-150">
            <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center">
              <Globe className="w-5 h-5 text-emerald-600 mr-2" />
              Public Respondent Link
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Survey: <strong>{selectedSurveyForLink.title}</strong> (v
              {selectedSurveyForLink.latest_version?.version_number || 1})
            </p>

            {linkError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1.5 flex-shrink-0" />
                {linkError}
              </div>
            )}

            {publicLinkResult ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs">
                  <p className="font-semibold mb-1">Public Link Active!</p>
                  <p>Anyone with this URL can open and submit responses to this published survey version.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Public Survey URL</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/s/${publicLinkResult.slug}`}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(publicLinkResult.slug)}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium flex items-center"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <a
                      href={`/s/${publicLinkResult.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSurveyForLink(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Custom URL Slug (Optional)
                  </label>
                  <div className="flex items-center">
                    <span className="text-xs text-slate-400 bg-slate-50 px-3 py-2 border border-r-0 border-slate-300 rounded-l-lg">
                      {window.location.origin}/s/
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. baseline-2026"
                      value={customSlug}
                      onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-r-lg text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Leave blank to automatically generate a secure random URL token.
                  </span>
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedSurveyForLink(null)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleGeneratePublicLink}
                    disabled={isGeneratingLink}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                  >
                    {isGeneratingLink ? 'Generating Link...' : 'Create Public Link'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
