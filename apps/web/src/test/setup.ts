import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// This config does not enable Vitest globals, so Testing Library's automatic
// cleanup never registers itself. Without this, renders accumulate in the DOM
// and queries start matching elements from earlier tests in the same file.
afterEach(cleanup);
