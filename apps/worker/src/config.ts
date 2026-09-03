/**
 * Worker configuration
 *
 * Centralized configuration for the worker process
 */

export const config = {
  // Job polling configuration
  polling: {
    intervalMs: parseInt(process.env.WORKER_POLL_INTERVAL_MS || '5000', 10),
    batchSize: parseInt(process.env.WORKER_BATCH_SIZE || '10', 10),
  },

  // Retry configuration
  retry: {
    maxAttempts: parseInt(process.env.WORKER_MAX_RETRY_ATTEMPTS || '3', 10),
    initialDelayMs: parseInt(process.env.WORKER_RETRY_INITIAL_DELAY_MS || '1000', 10),
    maxDelayMs: parseInt(process.env.WORKER_RETRY_MAX_DELAY_MS || '60000', 10),
    backoffMultiplier: parseFloat(process.env.WORKER_RETRY_BACKOFF_MULTIPLIER || '2'),
  },

  // Timeout configuration
  timeouts: {
    jobProcessingMs: parseInt(process.env.WORKER_JOB_TIMEOUT_MS || '300000', 10), // 5 min
    stageTimeoutMs: parseInt(process.env.WORKER_STAGE_TIMEOUT_MS || '60000', 10), // 1 min
  },

  // OpenAI configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    knowledgeModel: process.env.OPENAI_KNOWLEDGE_MODEL || 'deepseek-v4-pro',
    visualModel: process.env.OPENAI_VISUAL_MODEL || 'deepseek-v4-flash-vision-exp',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    maxRetries: 3,
    timeout: 60000,
  },

  // Supabase configuration
  supabase: {
    url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },

  // Feature flags
  features: {
    enableDetailedLogging: process.env.WORKER_DETAILED_LOGGING === 'true',
    enableMetrics: process.env.WORKER_ENABLE_METRICS === 'true',
  },
} as const;

// Validate required configuration
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.supabase.url) {
    errors.push('SUPABASE_URL is required');
  }

  if (!config.supabase.serviceRoleKey) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required');
  }

  if (!config.openai.apiKey) {
    errors.push('OPENAI_API_KEY is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}
