/**
 * Job type definitions
 *
 * Will be fully implemented in Plan 02
 */

export type JobType = 'document-ingestion' | 'ai-analysis' | 'graph-update';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  workspaceId: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}
