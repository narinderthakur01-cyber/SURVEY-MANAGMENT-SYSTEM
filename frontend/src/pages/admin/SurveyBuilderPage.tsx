import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import {
  Survey,
  SurveyVersion,
  SurveySection,
  Question,
  QuestionType,
} from '../../types/survey';
import { SurveyRunner } from '../../components/survey/SurveyRunner';
import {
  ArrowLeft,
  Save,
  Send,
  Eye,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Type,
  AlignLeft,
  Hash,
  CheckSquare,
  List,
  Star,
  Calendar,
  ToggleLeft,
  Camera,
  FileUp,
  MapPin,
} from 'lucide-react';

const QUESTION_TYPES_CONFIG: {
  type: QuestionType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  hasOptions?: boolean;
}[] = [
  { type: 'SHORT_TEXT', label: 'Short Text', icon: Type, description: 'Single line text input' },
  { type: 'LONG_TEXT', label: 'Long Text', icon: AlignLeft, description: 'Multi-line detailed answer' },
  { type: 'NUMBER', label: 'Number', icon: Hash, description: 'Integer or decimal numeric input' },
  { type: 'SINGLE_CHOICE', label: 'Single Choice', icon: CheckSquare, description: 'Select one from multiple options', hasOptions: true },
  { type: 'MULTIPLE_CHOICE', label: 'Multiple Choice', icon: CheckSquare, description: 'Select multiple checkboxes', hasOptions: true },
  { type: 'DROPDOWN', label: 'Dropdown', icon: List, description: 'Select from dropdown menu', hasOptions: true },
  { type: 'RATING', label: 'Star Rating', icon: Star, description: '1 to 5 star rating scale' },
  { type: 'DATE', label: 'Date', icon: Calendar, description: 'Date selection input' },
  { type: 'YES_NO', label: 'Yes / No', icon: ToggleLeft, description: 'Binary boolean response' },
  { type: 'IMAGE_UPLOAD', label: 'Photo Capture', icon: Camera, description: 'Upload or capture photo evidence' },
  { type: 'FILE_UPLOAD', label: 'Document Upload', icon: FileUp, description: 'Attach PDF or document' },
  { type: 'GPS_CAPTURE', label: 'GPS Location', icon: MapPin, description: 'Capture verified coordinates' },
];

export const SurveyBuilderPage: React.FC = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [currentVersion, setCurrentVersion] = useState<SurveyVersion | null>(null);
  const [sections, setSections] = useState<SurveySection[]>([]);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Fetch Survey and latest version
  useEffect(() => {
    const loadSurveyData = async () => {
      try {
        setIsLoading(true);
        const sRes = await api.get<Survey>(`/surveys/${surveyId}`);
        setSurvey(sRes.data);

        // Fetch latest version tree
        const latestVId = sRes.data.latest_version?.id || sRes.data.versions[0]?.id;
        if (latestVId) {
          const vRes = await api.get<SurveyVersion>(`/surveys/versions/${latestVId}`);
          setCurrentVersion(vRes.data);
          if (vRes.data.sections && vRes.data.sections.length > 0) {
            setSections(vRes.data.sections);
          } else {
            // Initialize with one default section if empty
            setSections([
              {
                title: 'General Information',
                description: 'Please answer the following questions',
                display_order: 1,
                questions: [],
              },
            ]);
          }
        }
      } catch (err: any) {
        setFeedback({
          type: 'error',
          message: err.response?.data?.detail || 'Failed to load survey data.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (surveyId) {
      loadSurveyData();
    }
  }, [surveyId]);

  // Section Management
  const handleAddSection = () => {
    const newSec: SurveySection = {
      title: `Section ${sections.length + 1}`,
      description: '',
      display_order: sections.length + 1,
      questions: [],
    };
    setSections([...sections, newSec]);
    setActiveSectionIndex(sections.length);
  };

  const handleDeleteSection = (index: number) => {
    if (sections.length <= 1) {
      alert('A survey must contain at least one section.');
      return;
    }
    const updated = sections.filter((_, i) => i !== index);
    setSections(updated);
    setActiveSectionIndex(Math.max(0, index - 1));
  };

  const handleUpdateSectionTitle = (index: number, title: string) => {
    const updated = [...sections];
    updated[index].title = title;
    setSections(updated);
  };

  const handleUpdateSectionDesc = (index: number, description: string) => {
    const updated = [...sections];
    updated[index].description = description;
    setSections(updated);
  };

  // Question Management
  const handleAddQuestion = (type: QuestionType) => {
    const activeSec = sections[activeSectionIndex];
    if (!activeSec) return;

    const defaultOptions = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'DROPDOWN'].includes(type)
      ? [
          { option_text: 'Option 1', option_value: 'opt_1', display_order: 1 },
          { option_text: 'Option 2', option_value: 'opt_2', display_order: 2 },
        ]
      : [];

    const newQuestion: Question = {
      question_text: `New ${type.replace('_', ' ').toLowerCase()} question`,
      question_type: type,
      is_required: false,
      display_order: activeSec.questions.length + 1,
      options: defaultOptions,
      validation_rules: null,
      conditional_logic: null,
    };

    const updated = [...sections];
    updated[activeSectionIndex].questions.push(newQuestion);
    setSections(updated);
  };

  const handleUpdateQuestion = (qIndex: number, updates: Partial<Question>) => {
    const updated = [...sections];
    updated[activeSectionIndex].questions[qIndex] = {
      ...updated[activeSectionIndex].questions[qIndex],
      ...updates,
    };
    setSections(updated);
  };

  const handleDeleteQuestion = (qIndex: number) => {
    const updated = [...sections];
    updated[activeSectionIndex].questions = updated[activeSectionIndex].questions.filter((_, i) => i !== qIndex);
    setSections(updated);
  };

  const handleMoveQuestion = (qIndex: number, direction: 'up' | 'down') => {
    const currentQuestions = [...sections[activeSectionIndex].questions];
    const targetIndex = direction === 'up' ? qIndex - 1 : qIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentQuestions.length) return;

    const temp = currentQuestions[qIndex];
    currentQuestions[qIndex] = currentQuestions[targetIndex];
    currentQuestions[targetIndex] = temp;

    // re-assign display orders
    currentQuestions.forEach((q, idx) => {
      q.display_order = idx + 1;
    });

    const updated = [...sections];
    updated[activeSectionIndex].questions = currentQuestions;
    setSections(updated);
  };

  // Option Management
  const handleAddOption = (qIndex: number) => {
    const q = sections[activeSectionIndex].questions[qIndex];
    const optNum = (q.options?.length || 0) + 1;
    const newOptions = [
      ...(q.options || []),
      { option_text: `Option ${optNum}`, option_value: `opt_${optNum}`, display_order: optNum },
    ];
    handleUpdateQuestion(qIndex, { options: newOptions });
  };

  const handleUpdateOption = (qIndex: number, optIndex: number, text: string) => {
    const q = sections[activeSectionIndex].questions[qIndex];
    const updatedOpts = [...(q.options || [])];
    updatedOpts[optIndex] = {
      ...updatedOpts[optIndex],
      option_text: text,
      option_value: text.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
    };
    handleUpdateQuestion(qIndex, { options: updatedOpts });
  };

  const handleDeleteOption = (qIndex: number, optIndex: number) => {
    const q = sections[activeSectionIndex].questions[qIndex];
    const updatedOpts = (q.options || []).filter((_, i) => i !== optIndex);
    handleUpdateQuestion(qIndex, { options: updatedOpts });
  };

  // Save Draft (enforcing version immutability)
  const handleSaveDraft = async () => {
    if (!survey) return;

    try {
      setIsSaving(true);
      setFeedback(null);

      // Clean sections payload for backend
      const payload = sections.map((s, sIdx) => ({
        title: s.title.trim() || `Section ${sIdx + 1}`,
        description: s.description?.trim() || null,
        display_order: sIdx + 1,
        questions: s.questions.map((q, qIdx) => ({
          question_text: q.question_text.trim(),
          question_type: q.question_type,
          is_required: q.is_required,
          display_order: qIdx + 1,
          options: (q.options || []).map((o, oIdx) => ({
            option_text: o.option_text.trim(),
            option_value: o.option_value.trim() || `opt_${oIdx + 1}`,
            display_order: oIdx + 1,
          })),
          validation_rules: q.validation_rules || null,
          conditional_logic: q.conditional_logic || null,
        })),
      }));

      const res = await api.post<SurveyVersion>(`/surveys/${survey.id}/draft`, payload);
      setCurrentVersion(res.data);
      if (res.data.sections) {
        setSections(res.data.sections);
      }

      setFeedback({
        type: 'success',
        message: `Draft successfully saved (Version ${res.data.version_number} - ${res.data.status})!`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to save survey draft.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Publish Survey Version
  const handlePublish = async () => {
    if (!currentVersion) return;

    // Check basic completeness on client side
    const totalQuestions = sections.reduce((acc, s) => acc + s.questions.length, 0);
    if (totalQuestions === 0) {
      setFeedback({
        type: 'error',
        message: 'Cannot publish a survey with 0 questions. Please add questions first.',
      });
      return;
    }

    try {
      setIsPublishing(true);
      setFeedback(null);

      // First save current draft to ensure all latest edits are persisted
      await handleSaveDraft();

      // Call publish
      const res = await api.post<SurveyVersion>(`/surveys/versions/${currentVersion.id}/publish`);
      setCurrentVersion(res.data);
      setFeedback({
        type: 'success',
        message: `Version ${res.data.version_number} has been PUBLISHED! It is now immutable and ready for distribution.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to publish survey version.',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-sky-600 animate-spin mb-3" />
        <p className="text-sm text-slate-500 font-medium">Loading Survey Builder...</p>
      </div>
    );
  }

  if (!survey || !currentVersion) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-lg mx-auto my-12">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 mb-2">Survey Not Found</h2>
        <Link to="/admin/surveys" className="text-sm text-sky-600 font-semibold hover:underline">
          Return to Survey Management
        </Link>
      </div>
    );
  }

  const isCurrentPublished = currentVersion.status === 'PUBLISHED';
  const activeSection = sections[activeSectionIndex];

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => navigate('/admin/surveys')}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Back to surveys"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{survey.title}</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isCurrentPublished
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              {isCurrentPublished ? '● Published' : '○ Draft'} (v{currentVersion.version_number})
            </span>
          </div>
          <p className="text-xs text-slate-500 pl-8">
            {survey.description || 'No description provided.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 pl-8 lg:pl-0">
          {/* Live Preview Button */}
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="inline-flex items-center px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Eye className="w-4 h-4 mr-1.5 text-slate-500" />
            Live Preview
          </button>

          {/* Save Draft Button */}
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="inline-flex items-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {isSaving ? 'Saving...' : 'Save Draft'}
          </button>

          {/* Publish Version Button */}
          {!isCurrentPublished && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing}
              className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4 mr-1.5" />
              {isPublishing ? 'Publishing...' : 'Publish Version'}
            </button>
          )}
        </div>
      </div>

      {/* Immutability Banner */}
      {isCurrentPublished && (
        <div className="bg-sky-50 border border-sky-200 p-4 rounded-xl flex items-start space-x-3 text-sky-900 text-xs">
          <HelpCircle className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Version Immutability Active:</span> Version{' '}
            {currentVersion.version_number} is locked in production to ensure respondent and task
            consistency. Modifying questions or clicking "Save Draft" will automatically create{' '}
            <strong>Version {currentVersion.version_number + 1} (Draft)</strong> without altering this
            published version.
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Builder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Sections List (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center">
                <Layers className="w-4 h-4 mr-1.5 text-sky-600" />
                Sections ({sections.length})
              </h3>
              <button
                type="button"
                onClick={handleAddSection}
                className="p-1 hover:bg-slate-100 text-sky-600 rounded"
                title="Add Section"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              {sections.map((sec, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveSectionIndex(idx)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center justify-between ${
                    activeSectionIndex === idx
                      ? 'bg-sky-50 text-sky-900 border border-sky-300 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="truncate pr-2">
                    <span>{idx + 1}. </span>
                    <span>{sec.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                    {sec.questions.length}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Palette: Question Types */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Add Question
            </h3>
            <div className="grid grid-cols-1 gap-1.5">
              {QUESTION_TYPES_CONFIG.map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => handleAddQuestion(item.type)}
                    className="flex items-center text-left p-2 rounded-lg hover:bg-sky-50 hover:text-sky-900 text-slate-700 transition-colors group"
                  >
                    <div className="p-1.5 bg-slate-100 group-hover:bg-sky-100 rounded text-slate-600 group-hover:text-sky-600 mr-2.5">
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">{item.label}</div>
                      <div className="text-[10px] text-slate-400">{item.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center Canvas: Active Section & Questions (9 cols) */}
        <div className="lg:col-span-9 space-y-6">
          {activeSection ? (
            <div className="space-y-6">
              {/* Active Section Config Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Section {activeSectionIndex + 1} Settings
                  </span>
                  {sections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSection(activeSectionIndex)}
                      className="text-rose-600 hover:text-rose-700 text-xs font-medium flex items-center"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Delete Section
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Section Title
                    </label>
                    <input
                      type="text"
                      value={activeSection.title}
                      onChange={(e) => handleUpdateSectionTitle(activeSectionIndex, e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Section Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={activeSection.description || ''}
                      onChange={(e) => handleUpdateSectionDesc(activeSectionIndex, e.target.value)}
                      placeholder="Context or instructions for this section..."
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* Questions in Active Section */}
              <div className="space-y-4">
                {activeSection.questions.length === 0 ? (
                  <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
                    <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-sm font-semibold text-slate-800">
                      No questions in this section yet
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Click any question type in the palette on the left to add your first question.
                    </p>
                  </div>
                ) : (
                  activeSection.questions.map((q, qIdx) => {
                    const qConfig = QUESTION_TYPES_CONFIG.find((c) => c.type === q.question_type);
                    const IconComponent = qConfig?.icon || Type;

                    return (
                      <div
                        key={q.id || qIdx}
                        className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 transition-all hover:border-slate-300"
                      >
                        {/* Question Card Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div className="flex items-center space-x-2">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center">
                              {qIdx + 1}
                            </span>
                            <div className="flex items-center text-xs font-semibold text-sky-800 bg-sky-50 px-2.5 py-1 rounded">
                              <IconComponent className="w-3.5 h-3.5 mr-1 text-sky-600" />
                              {qConfig?.label}
                            </div>
                          </div>

                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleMoveQuestion(qIdx, 'up')}
                              disabled={qIdx === 0}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                              title="Move question up"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveQuestion(qIdx, 'down')}
                              disabled={qIdx === activeSection.questions.length - 1}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                              title="Move question down"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(qIdx)}
                              className="p-1 text-rose-500 hover:text-rose-700 ml-1"
                              title="Delete question"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Question Text & Controls */}
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Question Text <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={q.question_text}
                              onChange={(e) =>
                                handleUpdateQuestion(qIdx, { question_text: e.target.value })
                              }
                              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                              placeholder="Enter your question prompt..."
                            />
                          </div>

                          {/* Options Editor for Choice Types */}
                          {qConfig?.hasOptions && (
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-semibold text-slate-700">
                                  Choices / Options (Minimum 2 required)
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleAddOption(qIdx)}
                                  className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center"
                                >
                                  <Plus className="w-3.5 h-3.5 mr-1" />
                                  Add Option
                                </button>
                              </div>

                              {q.options?.map((opt, optIdx) => (
                                <div key={optIdx} className="flex items-center space-x-2">
                                  <span className="text-xs text-slate-400 w-4">{optIdx + 1}.</span>
                                  <input
                                    type="text"
                                    value={opt.option_text}
                                    onChange={(e) =>
                                      handleUpdateOption(qIdx, optIdx, e.target.value)
                                    }
                                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-sky-500"
                                    placeholder="Option text..."
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOption(qIdx, optIdx)}
                                    disabled={q.options.length <= 2}
                                    className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                                    title="Delete option"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Settings Footer: Required Toggle and Validation */}
                          <div className="pt-2 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 border-t border-slate-100">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={q.is_required}
                                onChange={(e) =>
                                  handleUpdateQuestion(qIdx, { is_required: e.target.checked })
                                }
                                className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                              />
                              <span className="font-semibold text-slate-700">Mandatory / Required Field</span>
                            </label>

                            {q.question_type === 'NUMBER' && (
                              <div className="flex items-center space-x-2">
                                <span className="text-[11px] text-slate-400">Range:</span>
                                <input
                                  type="number"
                                  placeholder="Min"
                                  value={q.validation_rules?.min ?? ''}
                                  onChange={(e) =>
                                    handleUpdateQuestion(qIdx, {
                                      validation_rules: {
                                        ...q.validation_rules,
                                        min: e.target.value ? Number(e.target.value) : undefined,
                                      },
                                    })
                                  }
                                  className="w-16 px-2 py-1 border border-slate-300 rounded text-xs"
                                />
                                <span>-</span>
                                <input
                                  type="number"
                                  placeholder="Max"
                                  value={q.validation_rules?.max ?? ''}
                                  onChange={(e) =>
                                    handleUpdateQuestion(qIdx, {
                                      validation_rules: {
                                        ...q.validation_rules,
                                        max: e.target.value ? Number(e.target.value) : undefined,
                                      },
                                    })
                                  }
                                  className="w-16 px-2 py-1 border border-slate-300 rounded text-xs"
                                />
                              </div>
                            )}

                            {['SHORT_TEXT', 'LONG_TEXT'].includes(q.question_type) && (
                              <div className="flex items-center space-x-2">
                                <span className="text-[11px] text-slate-400">Max Length:</span>
                                <input
                                  type="number"
                                  placeholder="Characters"
                                  value={q.validation_rules?.max_length ?? ''}
                                  onChange={(e) =>
                                    handleUpdateQuestion(qIdx, {
                                      validation_rules: {
                                        ...q.validation_rules,
                                        max_length: e.target.value ? Number(e.target.value) : undefined,
                                      },
                                    })
                                  }
                                  className="w-20 px-2 py-1 border border-slate-300 rounded text-xs"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <p className="text-sm text-slate-500">Please select or add a section.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Live Interactive Preview */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full my-8 overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Preview Modal Header */}
            <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center space-x-2">
                <Eye className="w-5 h-5 text-sky-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Live Survey Preview • {survey.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview Runner Body */}
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              <SurveyRunner
                version={{
                  ...currentVersion,
                  sections: sections,
                }}
                previewMode={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
