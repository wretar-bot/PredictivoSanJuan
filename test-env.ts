import { loadEnv } from 'vite';
const env = loadEnv('development', '.', '');
console.log('GEMINI_API_KEY:', env.GEMINI_API_KEY);
