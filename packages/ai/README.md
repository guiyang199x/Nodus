# @knowledge/ai

Provider-neutral adapters for embeddings, visual extraction, structured knowledge analysis, and grounded chat.

Web and Worker import this package instead of a vendor SDK. OpenAI is the first adapter and lands in Plans 02–04. Every provider call must use `store: false`.

```ts
import { AI_PACKAGE } from '@knowledge/ai';
```
