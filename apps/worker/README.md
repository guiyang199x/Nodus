# @knowledge/worker

Background job processor for the AI Knowledge Base project.

## Overview

The worker is responsible for:

- **Document Ingestion Pipeline**: Processing uploaded files through validation, extraction, and chunking stages
- **AI Analysis**: Extracting topics, tags, entities, and relationships from document chunks
- **Knowledge Graph Updates**: Maintaining the knowledge graph based on analysis results
- **Job Management**: Polling Supabase queue, processing jobs, and updating status

## Getting Started

### Development

From the workspace root:

```bash
# Install dependencies (if not already done)
pnpm install

# Start Supabase (if not already running)
pnpm db:start

# Start the worker in watch mode
pnpm dev:worker
```

### Production

```bash
pnpm --filter @knowledge/worker build
pnpm --filter @knowledge/worker start
```

## Project Structure

```
apps/worker/
├── src/
│   ├── index.ts           # Worker entry point
│   ├── config.ts          # Configuration management
│   ├── lib/               # Utility functions
│   │   └── supabase.ts    # Supabase client
│   ├── stages/            # Job processing stages (Plan 02)
│   │   ├── validate.ts
│   │   ├── extract.ts
│   │   ├── chunk.ts
│   │   └── analyze.ts
│   └── types/             # TypeScript type definitions
│       └── job.ts
├── package.json
└── tsconfig.json
```

## Architecture

### Job Processing Pipeline

1. **Poll Queue**: Fetch pending jobs from Supabase pg_queue
2. **Claim Job**: Lock job for processing (prevents duplicate processing)
3. **Process Stages**: Execute job-specific pipeline stages
4. **Update Status**: Mark job as completed or failed
5. **Retry Logic**: Automatic retry with exponential backoff for transient failures

### Stage Pipeline (Plan 02)

For document ingestion:

```
validate → extract → chunk → embed → analyze → graph-update
```

Each stage:
- Is idempotent (can be safely retried)
- Has timeout protection
- Logs progress and errors
- Updates job status

## Environment Variables

Required variables (loaded from workspace root `.env.local`):

```bash
# Supabase
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=sk-your-api-key
OPENAI_KNOWLEDGE_MODEL=gpt-4o-2024-11-20
OPENAI_VISUAL_MODEL=gpt-4o
EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EMBEDDING_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-v4
EMBEDDING_DIMENSIONS=1024

# Worker Configuration (optional)
WORKER_POLL_INTERVAL_MS=5000
WORKER_BATCH_SIZE=10
WORKER_MAX_RETRY_ATTEMPTS=3
WORKER_JOB_TIMEOUT_MS=300000
```

See `../../.env.README.md` for full configuration details.

## Job Types

### 1. Document Ingestion

Processes uploaded documents through the full pipeline:
- File validation (type, size, virus scan)
- Format extraction (PDF, DOCX, images, etc.)
- Chunking (semantic segmentation)
- Embedding generation
- AI analysis (topics, tags, entities, relations)

### 2. AI Analysis

Re-analyzes existing chunks with updated AI models or prompts.

### 3. Graph Update

Refreshes knowledge graph nodes and edges based on new analysis.

## Error Handling

### Retry Strategy

- **Transient Errors**: Auto-retry with exponential backoff
- **Permanent Errors**: Mark job as failed, no retry
- **Max Attempts**: 3 retries (configurable)

### Error Categories

- **Validation Errors**: Invalid file format, size exceeded
- **Extraction Errors**: Corrupt file, unsupported format
- **AI Errors**: Rate limit, quota exceeded, timeout
- **Database Errors**: Connection lost, constraint violation

## Monitoring

### Logs

Structured logging with context:

```typescript
{
  timestamp: '2026-09-03T12:00:00Z',
  level: 'info',
  jobId: 'job_123',
  stage: 'extract',
  message: 'PDF extraction completed',
  duration: 1234
}
```

### Metrics (Plan 05)

- Jobs processed per minute
- Average processing time per stage
- Error rate by type
- Queue depth

## Testing

```bash
# Run unit tests
pnpm --filter @knowledge/worker test

# Run with coverage
pnpm --filter @knowledge/worker test:coverage
```

## Deployment

### Docker

```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY apps/worker ./apps/worker
COPY packages ./packages
CMD ["pnpm", "--filter", "@knowledge/worker", "start"]
```

### Health Checks

Worker exposes health endpoint on `/health` (Plan 05).

## Security Considerations

- **Service Role Key**: Never expose in client code
- **RLS Bypass**: Worker uses service role, must validate workspace_id
- **File Validation**: Virus scan before processing
- **Resource Limits**: Timeout protection, memory limits
- **Secrets**: Store in environment variables, never commit

## Performance Tips

- **Batch Processing**: Process multiple jobs per poll cycle
- **Parallel Stages**: Use worker pool for CPU-intensive tasks
- **Caching**: Cache AI model responses, embeddings
- **Queue Management**: Prioritize critical jobs, drop stale jobs

## Troubleshooting

### Worker not processing jobs

1. Check Supabase connection: `pnpm db:status`
2. Verify service role key in `.env.local`
3. Check queue for pending jobs in Supabase Studio
4. Review worker logs for errors

### High error rate

1. Check OpenAI API quota and limits
2. Verify file formats are supported
3. Review error logs for patterns
4. Consider increasing retry attempts

### Slow processing

1. Profile stage execution times
2. Check database query performance
3. Review OpenAI API latency
4. Consider scaling workers horizontally

## Future Enhancements (Post-MVP)

- Horizontal scaling with multiple workers
- Priority queue for urgent jobs
- Dead letter queue for failed jobs
- Real-time progress updates via WebSocket
- Worker pool for parallel processing
- Metrics dashboard

## Tech Stack

- Node.js 24 LTS
- TypeScript
- Supabase (pg_queue, RPC)
- OpenAI API
- tsx (for development)
- Zod (for validation)
