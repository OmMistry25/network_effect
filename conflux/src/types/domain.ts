export interface Person {
  id: string;
  workspace_id: string;
  full_name: string;
  primary_email: string | null;
  phone: string | null;
  title: string | null;
  headline: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  workspace_id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Affiliation {
  id: string;
  workspace_id: string;
  person_id: string;
  organization_id: string;
  role_title: string | null;
  start_date: string | null;
  end_date: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface Interaction {
  id: string;
  workspace_id: string;
  occurred_at: string;
  interaction_type: 'meeting' | 'call' | 'email' | 'conference' | 'note';
  title: string | null;
  summary: string | null;
  raw_text: string | null;
  created_by: string;
  source: 'manual' | 'import' | 'integration';
  created_at: string;
  updated_at: string;
}

export interface GraphEdge {
  id: string;
  workspace_id: string;
  src_type: 'person' | 'organization' | 'topic' | 'custom';
  src_id: string;
  dst_type: 'person' | 'organization' | 'topic' | 'custom';
  dst_id: string;
  edge_type: string;
  weight: number;
  evidence_interaction_id: string | null;
  properties: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
