export type QuestionType =
  | 'SHORT_TEXT'
  | 'LONG_TEXT'
  | 'NUMBER'
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'DROPDOWN'
  | 'RATING'
  | 'DATE'
  | 'YES_NO'
  | 'IMAGE_UPLOAD'
  | 'FILE_UPLOAD'
  | 'GPS_CAPTURE';

export type SurveyVersionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface QuestionOption {
  id?: string;
  option_text: string;
  option_value: string;
  display_order: number;
}

export interface QuestionValidationRules {
  min_length?: number;
  max_length?: number;
  min?: number;
  max?: number;
  min_rating?: number;
  max_rating?: number;
  regex?: string;
}

export interface ConditionalLogic {
  action: 'show' | 'hide';
  field: string; // question_id or question reference
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface Question {
  id?: string;
  question_text: string;
  question_type: QuestionType;
  is_required: boolean;
  display_order: number;
  options: QuestionOption[];
  validation_rules?: QuestionValidationRules | null;
  conditional_logic?: ConditionalLogic | null;
}

export interface SurveySection {
  id?: string;
  title: string;
  description?: string | null;
  display_order: number;
  questions: Question[];
}

export interface SurveyVersionSummary {
  id: string;
  version_number: number;
  status: SurveyVersionStatus;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SurveyVersion extends SurveyVersionSummary {
  survey_id: string;
  survey_title?: string | null;
  sections: SurveySection[];
}

export interface Survey {
  id: string;
  title: string;
  description?: string | null;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  versions: SurveyVersionSummary[];
  latest_version?: SurveyVersion | null;
}

export interface SurveyPublicLink {
  id: string;
  version_id: string;
  slug: string;
  is_active: boolean;
  expires_at?: string | null;
  created_at: string;
  survey_title?: string;
  version_number?: number;
}
