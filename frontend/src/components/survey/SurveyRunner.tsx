import React, { useState } from 'react';
import {
  SurveyVersion,
  Question,
} from '../../types/survey';
import {
  Star,
  MapPin,
  Upload,
  Image,
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Send,
} from 'lucide-react';

interface SurveyRunnerProps {
  version: SurveyVersion;
  previewMode?: boolean;
  onSubmitSuccess?: (answers: Record<string, any>) => void;
}

export const SurveyRunner: React.FC<SurveyRunnerProps> = ({
  version,
  previewMode = false,
  onSubmitSuccess,
}) => {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [gpsLoading, setGpsLoading] = useState<Record<string, boolean>>({});

  const handleAnswerChange = (questionKey: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionKey]: value,
    }));
    // Clear error on change
    if (errors[questionKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[questionKey];
        return next;
      });
    }
  };

  // Helper to determine if a question should be shown based on conditional logic
  const isQuestionVisible = (question: Question): boolean => {
    if (!question.conditional_logic) return true;

    const { field, operator, value, action } = question.conditional_logic;
    const controllingValue = answers[field];

    let conditionMet = false;
    switch (operator) {
      case 'equals':
        conditionMet = String(controllingValue).toLowerCase() === String(value).toLowerCase();
        break;
      case 'not_equals':
        conditionMet = String(controllingValue).toLowerCase() !== String(value).toLowerCase();
        break;
      case 'contains':
        if (Array.isArray(controllingValue)) {
          conditionMet = controllingValue.includes(value);
        } else {
          conditionMet = String(controllingValue || '').toLowerCase().includes(String(value).toLowerCase());
        }
        break;
      case 'greater_than':
        conditionMet = Number(controllingValue) > Number(value);
        break;
      case 'less_than':
        conditionMet = Number(controllingValue) < Number(value);
        break;
      default:
        conditionMet = true;
    }

    return action === 'show' ? conditionMet : !conditionMet;
  };

  const handleCaptureGps = (questionKey: string) => {
    if (!navigator.geolocation) {
      setAnswers((prev) => ({
        ...prev,
        [questionKey]: '37.7749° N, 122.4194° W (Mock Coordinates)',
      }));
      return;
    }

    setGpsLoading((prev) => ({ ...prev, [questionKey]: true }));
    let completed = false;

    const fallbackTimeout = setTimeout(() => {
      if (!completed) {
        completed = true;
        handleAnswerChange(questionKey, '37.774929, -122.419416 (Default Coordinates)');
        setGpsLoading((prev) => ({ ...prev, [questionKey]: false }));
      }
    }, 2500);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!completed) {
          completed = true;
          clearTimeout(fallbackTimeout);
          const coords = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)} (Acc: ${Math.round(pos.coords.accuracy)}m)`;
          handleAnswerChange(questionKey, coords);
          setGpsLoading((prev) => ({ ...prev, [questionKey]: false }));
        }
      },
      () => {
        if (!completed) {
          completed = true;
          clearTimeout(fallbackTimeout);
          // Fallback for permissions denied / sandbox
          handleAnswerChange(questionKey, '37.774929, -122.419416 (Default Coordinates)');
          setGpsLoading((prev) => ({ ...prev, [questionKey]: false }));
        }
      },
      { timeout: 2500, maximumAge: 60000, enableHighAccuracy: false }
    );
  };

  const handleFileUpload = (questionKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleAnswerChange(questionKey, `${file.name} (${Math.round(file.size / 1024)} KB)`);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    version.sections.forEach((section) => {
      section.questions.forEach((q, qIdx) => {
        const qKey = q.id || `q_${section.display_order}_${qIdx}`;

        // Skip validation if question is conditionally hidden
        if (!isQuestionVisible(q)) return;

        const val = answers[qKey];

        // Required check
        if (q.is_required && (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0))) {
          newErrors[qKey] = 'This field is required';
          return;
        }

        // Specific type validations
        if (val !== undefined && val !== null && val !== '') {
          if (q.question_type === 'NUMBER') {
            const num = Number(val);
            if (isNaN(num)) {
              newErrors[qKey] = 'Must be a valid number';
            } else {
              if (q.validation_rules?.min !== undefined && num < q.validation_rules.min) {
                newErrors[qKey] = `Minimum value is ${q.validation_rules.min}`;
              }
              if (q.validation_rules?.max !== undefined && num > q.validation_rules.max) {
                newErrors[qKey] = `Maximum value is ${q.validation_rules.max}`;
              }
            }
          }

          if (q.question_type === 'SHORT_TEXT' || q.question_type === 'LONG_TEXT') {
            const strVal = String(val);
            if (q.validation_rules?.min_length && strVal.length < q.validation_rules.min_length) {
              newErrors[qKey] = `Minimum ${q.validation_rules.min_length} characters required`;
            }
            if (q.validation_rules?.max_length && strVal.length > q.validation_rules.max_length) {
              newErrors[qKey] = `Maximum ${q.validation_rules.max_length} characters allowed`;
            }
          }
        }
      });
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      if (onSubmitSuccess) {
        onSubmitSuccess(answers);
      }
    }, 600);
  };

  if (isSubmitted) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center max-w-xl mx-auto my-8">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Survey Submitted Successfully!</h2>
        <p className="text-slate-600 mb-6">
          Thank you for taking the time to complete this survey. Your responses have been safely recorded.
        </p>
        {previewMode && (
          <button
            type="button"
            onClick={() => {
              setIsSubmitted(false);
              setAnswers({});
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            Reset Preview
          </button>
        )}
      </div>
    );
  }

  const renderQuestionInput = (q: Question, qKey: string) => {
    const val = answers[qKey];

    switch (q.question_type) {
      case 'SHORT_TEXT':
        return (
          <input
            type="text"
            value={val || ''}
            onChange={(e) => handleAnswerChange(qKey, e.target.value)}
            placeholder="Type your answer here..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm text-slate-800 placeholder-slate-400"
          />
        );

      case 'LONG_TEXT':
        return (
          <textarea
            rows={4}
            value={val || ''}
            onChange={(e) => handleAnswerChange(qKey, e.target.value)}
            placeholder="Write your detailed response here..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm text-slate-800 placeholder-slate-400"
          />
        );

      case 'NUMBER':
        return (
          <input
            type="number"
            value={val !== undefined ? val : ''}
            onChange={(e) => handleAnswerChange(qKey, e.target.value)}
            placeholder="Enter a number..."
            className="w-full sm:w-64 px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm text-slate-800"
          />
        );

      case 'SINGLE_CHOICE':
        return (
          <div className="space-y-2">
            {q.options?.map((opt, idx) => {
              const isChecked = val === opt.option_value;
              return (
                <label
                  key={idx}
                  className={`flex items-center p-3 rounded-lg border transition-all cursor-pointer ${
                    isChecked
                      ? 'border-sky-500 bg-sky-50 text-sky-900 font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name={qKey}
                    value={opt.option_value}
                    checked={isChecked}
                    onChange={() => handleAnswerChange(qKey, opt.option_value)}
                    className="w-4 h-4 text-sky-600 focus:ring-sky-500 border-slate-300 mr-3"
                  />
                  <span className="text-sm">{opt.option_text}</span>
                </label>
              );
            })}
          </div>
        );

      case 'MULTIPLE_CHOICE':
        const selectedArr: string[] = Array.isArray(val) ? val : [];
        return (
          <div className="space-y-2">
            {q.options?.map((opt, idx) => {
              const isChecked = selectedArr.includes(opt.option_value);
              return (
                <label
                  key={idx}
                  className={`flex items-center p-3 rounded-lg border transition-all cursor-pointer ${
                    isChecked
                      ? 'border-sky-500 bg-sky-50 text-sky-900 font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleAnswerChange(qKey, [...selectedArr, opt.option_value]);
                      } else {
                        handleAnswerChange(
                          qKey,
                          selectedArr.filter((item) => item !== opt.option_value)
                        );
                      }
                    }}
                    className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500 border-slate-300 mr-3"
                  />
                  <span className="text-sm">{opt.option_text}</span>
                </label>
              );
            })}
          </div>
        );

      case 'DROPDOWN':
        return (
          <select
            value={val || ''}
            onChange={(e) => handleAnswerChange(qKey, e.target.value)}
            className="w-full sm:w-80 px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm text-slate-800 bg-white"
          >
            <option value="">-- Please select an option --</option>
            {q.options?.map((opt, idx) => (
              <option key={idx} value={opt.option_value}>
                {opt.option_text}
              </option>
            ))}
          </select>
        );

      case 'RATING':
        const rating = Number(val) || 0;
        return (
          <div className="flex items-center space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                onClick={() => handleAnswerChange(qKey, star)}
                className={`p-2 rounded-lg transition-transform hover:scale-110 ${
                  star <= rating ? 'text-amber-400 bg-amber-50' : 'text-slate-300 hover:text-slate-400'
                }`}
              >
                <Star className="w-7 h-7 fill-current" />
              </button>
            ))}
            {rating > 0 && (
              <span className="text-xs font-semibold text-slate-500 ml-2">
                {rating} out of 5
              </span>
            )}
          </div>
        );

      case 'DATE':
        return (
          <div className="relative w-full sm:w-64">
            <input
              type="date"
              value={val || ''}
              onChange={(e) => handleAnswerChange(qKey, e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm text-slate-800"
            />
            <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
          </div>
        );

      case 'YES_NO':
        return (
          <div className="flex items-center space-x-4">
            {['yes', 'no'].map((choice) => {
              const isSelected = val === choice;
              return (
                <button
                  type="button"
                  key={choice}
                  onClick={() => handleAnswerChange(qKey, choice)}
                  className={`px-6 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                    isSelected
                      ? choice === 'yes'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-rose-600 text-white border-rose-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {choice === 'yes' ? 'Yes' : 'No'}
                </button>
              );
            })}
          </div>
        );

      case 'IMAGE_UPLOAD':
        return (
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-5 text-center hover:border-sky-400 transition-colors bg-slate-50">
            <Image className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <div className="text-sm text-slate-600">
              <label className="cursor-pointer text-sky-600 font-semibold hover:underline">
                Upload image file
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(qKey, e)}
                />
              </label>
              <span className="text-slate-400 text-xs block mt-1">PNG, JPG, WEBP up to 5MB</span>
            </div>
            {val && (
              <div className="mt-3 inline-flex items-center px-3 py-1 bg-sky-100 text-sky-800 text-xs font-medium rounded-full">
                Selected: {val}
              </div>
            )}
          </div>
        );

      case 'FILE_UPLOAD':
        return (
          <div className="flex items-center space-x-3">
            <label className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer">
              <Upload className="w-4 h-4 mr-2 text-slate-500" />
              Choose File
              <input
                type="file"
                className="hidden"
                onChange={(e) => handleFileUpload(qKey, e)}
              />
            </label>
            <span className="text-xs text-slate-500 truncate max-w-xs">
              {val || 'No file selected yet'}
            </span>
          </div>
        );

      case 'GPS_CAPTURE':
        return (
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              type="button"
              onClick={() => handleCaptureGps(qKey)}
              disabled={gpsLoading[qKey]}
              className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              <MapPin className="w-4 h-4 mr-2" />
              {gpsLoading[qKey] ? 'Acquiring GPS...' : 'Capture GPS Coordinates'}
            </button>
            {val ? (
              <span className="text-xs font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-md">
                📍 {val}
              </span>
            ) : (
              <span className="text-xs text-slate-400">GPS location required for verification</span>
            )}
          </div>
        );

      default:
        return <p className="text-sm text-slate-400">Unsupported question type</p>;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {previewMode && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2.5 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <HelpCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Preview Mode:</strong> You are viewing Version {version.version_number} ({version.status}). Submitting validates form responses in real-time.
            </span>
          </div>
        </div>
      )}

      {version.sections.map((section, sIdx) => (
        <div
          key={section.id || sIdx}
          className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
        >
          {/* Section Header */}
          <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">{section.title}</h3>
              <span className="text-xs font-medium text-slate-400">
                Section {sIdx + 1} of {version.sections.length}
              </span>
            </div>
            {section.description && (
              <p className="text-xs text-slate-500 mt-1">{section.description}</p>
            )}
          </div>

          {/* Questions Container */}
          <div className="p-6 space-y-6">
            {section.questions.map((q, qIdx) => {
              const qKey = q.id || `q_${section.display_order}_${qIdx}`;
              if (!isQuestionVisible(q)) {
                return null;
              }

              const error = errors[qKey];

              return (
                <div key={qKey} className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <label className="text-sm font-semibold text-slate-800">
                      <span className="text-slate-400 mr-2">{qIdx + 1}.</span>
                      {q.question_text}
                      {q.is_required && (
                        <span className="text-rose-500 ml-1 font-bold" title="Required">
                          *
                        </span>
                      )}
                    </label>
                  </div>

                  <div>{renderQuestionInput(q, qKey)}</div>

                  {error && (
                    <p className="text-xs text-rose-600 flex items-center mt-1">
                      <AlertCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                      {error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Submit Action */}
      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors disabled:opacity-50"
        >
          <Send className="w-4 h-4 mr-2" />
          {isSubmitting ? 'Submitting Responses...' : previewMode ? 'Test Form Validation' : 'Submit Survey'}
        </button>
      </div>
    </form>
  );
};
