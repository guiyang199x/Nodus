#!/usr/bin/env node

/**
 * Verify environment variables are loaded correctly
 * Usage: node scripts/verify-env.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local manually for verification
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');

console.log('🔍 Environment Variable Verification\n');
console.log('=' .repeat(60));

// Parse and check required variables
const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_KNOWLEDGE_MODEL',
  'OPENAI_VISUAL_MODEL',
  'OPENAI_EMBEDDING_MODEL',
];

const parsedVars = {};
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      parsedVars[key] = valueParts.join('=');
    }
  }
});

let allValid = true;

requiredVars.forEach((varName) => {
  const value = parsedVars[varName];
  const isSet = value && value !== '' && !value.includes('your-');
  const status = isSet ? '✅' : '❌';

  if (!isSet) allValid = false;

  // Mask sensitive values
  let displayValue = value || '(not set)';
  if (varName.includes('KEY') || varName.includes('SECRET')) {
    displayValue = value ? `set (ends …${value.slice(-4)})` : '(not set)';
  }

  console.log(`${status} ${varName}`);
  console.log(`   ${displayValue}\n`);
});

console.log('=' .repeat(60));
if (allValid) {
  console.log('All required environment variables are set.\n');
  process.exit(0);
} else {
  console.log('❌ Some environment variables are missing or not configured.\n');
  console.log('Please update .env.local with the correct values.');
  process.exit(1);
}
