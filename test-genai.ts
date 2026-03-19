import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: undefined });
ai.models.generateContent({
  model: 'gemini-3-flash-preview',
  contents: 'Hello'
}).then(res => console.log(res.text))
.catch(err => console.error(err.message));
