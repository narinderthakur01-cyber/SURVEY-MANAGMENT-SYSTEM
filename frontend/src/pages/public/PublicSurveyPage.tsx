import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../lib/api';
import { SurveyVersion } from '../../types/survey';
import { SurveyRunner } from '../../components/survey/SurveyRunner';
import { Activity, AlertTriangle, Loader2 } from 'lucide-react';

export const PublicSurveyPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [version, setVersion] = useState<SurveyVersion | null>(null);
  const [surveyTitle, setSurveyTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPublicSurvey = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await api.get<SurveyVersion>(`/surveys/public/${slug}`);
        setVersion(res.data);
        if (res.data.survey_title) {
          setSurveyTitle(res.data.survey_title);
        } else {
          setSurveyTitle('Field Survey');
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError('This survey link does not exist or has been deactivated.');
        } else if (err.response?.status === 410) {
          setError('This survey link has expired and is no longer accepting responses.');
        } else {
          setError('Unable to load this survey at this time. Please try again later.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) {
      fetchPublicSurvey();
    }
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-sky-600 animate-spin mb-3" />
        <p className="text-slate-600 text-sm font-medium">Loading survey form...</p>
      </div>
    );
  }

  if (error || !version) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Survey Unavailable</h2>
          <p className="text-slate-600 text-sm">{error || 'Survey could not be found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Brand Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-sky-600 rounded-lg text-white">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">
              {surveyTitle}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Official Survey • Version {version.version_number}
            </p>
          </div>
        </div>

        {/* Survey Runner */}
        <SurveyRunner version={version} previewMode={false} />

        {/* Footer */}
        <div className="text-center pt-8 text-xs text-slate-400">
          Powered by SurveyTrack • Single-Organization Field Workforce Management
        </div>
      </div>
    </div>
  );
};
