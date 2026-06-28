export type IssueCategory = 'infrastructure' | 'sanitation' | 'safety' | 'utility' | 'environment'
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'false_closure' | 'closed' | 'community_review'
export type UserRole = 'citizen' | 'admin'

export interface Profile {
  id: string
  phone: string | null
  email: string | null
  role: UserRole
  karma_score: number
  ward_id: number | null
  push_subscription: object | null
  home_location: any | null
  home_address: string | null
  created_at: string
}

export interface Issue {
  id: string
  user_id: string
  title: string
  description: string
  category: IssueCategory
  subcategory: string | null
  severity: number
  is_emergency: boolean
  status: IssueStatus
  pipeline_stage: string | null
  location: { lat: number; lng: number }
  address: string
  ward_id: number | null
  photo_url: string | null
  video_url: string | null
  credibility_score: number | null
  cluster_id: string | null
  department_id: string | null
  needs_community_verification: boolean | null
  reasoning: string | null
  civic_brief: string | null
  local_civic_brief: string | null
  original_language: string | null
  translation_trace: string | null
  sla_deadline: string | null
  resolved_at: string | null
  agent5_completed?: boolean
  created_at: string
}

export interface Department {
  id: string
  name: string
  category_scope: string[]
  avg_resolution_hours: number
}

export interface Verification {
  id: string
  issue_id: string
  user_id: string
  verdict: boolean
  photo_url: string | null
  created_at: string
}

export interface IssueComment {
  id: string
  issue_id: string
  user_id: string
  comment_text: string
  created_at: string
}

export interface KarmaEvent {
  id: string
  user_id: string
  event_type: string
  points: number
  issue_id: string | null
  created_at: string
}

export interface PredictiveAlert {
  id: string
  ward_id: number | null
  predicted_category: string
  confidence: number
  prediction_date: string
  basis_summary: string
  is_actioned: boolean
  created_at: string
}

export interface AgentState {
  [key: string]: any;
  reportId: string
  rawText: string
  originalLanguage: string
  englishTranslation: string
  translationTrace: string
  imageUrl: string | null
  videoUrl: string | null
  coordinates: { lat: number; lng: number }
  userId: string
  address: string
  classification: ClassificationResult | null
  deduplication: DeduplicationResult | null
  validation: ValidationResult | null
  resolution: ResolutionResult | null
  error: string | null
  imageAnalysis: string
}

export interface ClassificationResult {
  category: IssueCategory
  subcategory: string
  severity: number
  is_emergency: boolean
  department_id: string | null
  suggested_title: string
}

export interface DeduplicationResult {
  is_duplicate: boolean
  cluster_id: string | null
  existing_issue_id: string | null
  similarity_score: number
}

export interface ValidationResult {
  credibility_score: number
  reasoning: string
  needs_community_verification: boolean
  weather_corroborated: boolean
}

export interface ResolutionResult {
  civic_brief: string
  local_civic_brief?: string
  sla_hours: number
  sla_deadline: string
}