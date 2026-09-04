import { describe, expect, it } from 'vitest';

import { readEmbeddingProviderConfig, readKnowledgeProviderConfig } from './config';

const knowledge = {
  OPENAI_BASE_URL: 'https://api.deepseek.com',
  OPENAI_API_KEY: 'sk-knowledge',
  OPENAI_KNOWLEDGE_MODEL: 'deepseek-v4-pro',
  OPENAI_VISUAL_MODEL: 'deepseek-v4-flash-vision-exp',
};

const embedding = {
  EMBEDDING_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  EMBEDDING_API_KEY: 'sk-embedding',
  EMBEDDING_MODEL: 'text-embedding-v4',
  EMBEDDING_DIMENSIONS: '1024',
};

describe('provider configuration', () => {
  it('reads the two providers independently', () => {
    expect(readKnowledgeProviderConfig(knowledge).knowledgeModel).toBe('deepseek-v4-pro');
    expect(readEmbeddingProviderConfig(embedding)).toEqual({
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'sk-embedding',
      model: 'text-embedding-v4',
      dimensions: 1024,
    });
  });

  it('does not let the knowledge provider stand in for the embedding provider', () => {
    // The exact mistake this split exists to prevent: pointing an embedding
    // model at a base URL whose vendor has no embeddings endpoint.
    expect(() => readEmbeddingProviderConfig(knowledge)).toThrow('向量嵌入供应商');
  });

  it('requires an explicit dimension, because the vector column is built from it', () => {
    const { EMBEDDING_DIMENSIONS: _omitted, ...rest } = embedding;
    expect(() => readEmbeddingProviderConfig(rest)).toThrow('dimensions');
  });

  it('rejects a non-numeric or absurd dimension', () => {
    expect(() => readEmbeddingProviderConfig({ ...embedding, EMBEDDING_DIMENSIONS: 'large' })).toThrow(
      'dimensions'
    );
    expect(() => readEmbeddingProviderConfig({ ...embedding, EMBEDDING_DIMENSIONS: '999999' })).toThrow(
      'dimensions'
    );
  });
});
