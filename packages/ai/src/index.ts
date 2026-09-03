/**
 * Provider-neutral AI adapters for embeddings, visual extraction,
 * structured knowledge analysis, and grounded chat.
 *
 * Concrete adapters land in Plans 02–04. This package exists so Web and
 * Worker can depend on a stable import path without coupling to a vendor SDK.
 */
export const AI_PACKAGE = '@knowledge/ai' as const;
