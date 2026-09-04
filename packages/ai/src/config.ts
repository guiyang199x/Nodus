import { z } from 'zod';

/**
 * Analysis and embedding are separate providers on purpose.
 *
 * A single OPENAI_* block assumes one vendor supplies every capability, which
 * is not true here: DeepSeek serves knowledge and visual models but publishes
 * no embeddings endpoint at all, so the vector half of hybrid search has to
 * come from somewhere else. Keeping them apart also matches the rule that a
 * provider or model identifier is deployment configuration, never a constant
 * baked into business logic.
 */
const KnowledgeProviderSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  knowledgeModel: z.string().min(1),
  visualModel: z.string().min(1),
});

const EmbeddingProviderSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  /**
   * Required, with no default. The vector column is declared as vector(N) in
   * the search migration, so changing this later means rebuilding the index
   * and re-embedding every chunk. It has to be a deliberate choice.
   */
  dimensions: z.coerce.number().int().positive().max(4096),
});

export type KnowledgeProviderConfig = z.infer<typeof KnowledgeProviderSchema>;
export type EmbeddingProviderConfig = z.infer<typeof EmbeddingProviderSchema>;

type Env = Record<string, string | undefined>;

function explain(name: string, error: z.ZodError): never {
  const detail = error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  throw new Error(`${name} 配置无效 — ${detail}`);
}

export function readKnowledgeProviderConfig(env: Env = process.env): KnowledgeProviderConfig {
  const parsed = KnowledgeProviderSchema.safeParse({
    baseUrl: env.OPENAI_BASE_URL,
    apiKey: env.OPENAI_API_KEY,
    knowledgeModel: env.OPENAI_KNOWLEDGE_MODEL,
    visualModel: env.OPENAI_VISUAL_MODEL,
  });
  return parsed.success ? parsed.data : explain('知识分析供应商', parsed.error);
}

export function readEmbeddingProviderConfig(env: Env = process.env): EmbeddingProviderConfig {
  const parsed = EmbeddingProviderSchema.safeParse({
    baseUrl: env.EMBEDDING_BASE_URL,
    apiKey: env.EMBEDDING_API_KEY,
    model: env.EMBEDDING_MODEL,
    dimensions: env.EMBEDDING_DIMENSIONS,
  });
  return parsed.success ? parsed.data : explain('向量嵌入供应商', parsed.error);
}
