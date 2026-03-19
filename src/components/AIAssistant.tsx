import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Send, Bot, User, Loader2, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export function AIAssistant() {
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string; isSearching?: boolean }[]>([
    { role: 'model', text: 'Hola, soy tu asistente experto en mantenimiento predictivo. Puedo ayudarte con dudas sobre termografía, ultrasonido, análisis de vibraciones, normativas de equipos y más. ¿En qué te puedo ayudar hoy?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Add a temporary loading message to show search is active
      setMessages(prev => [...prev, { role: 'model', text: 'Buscando información...', isSearching: true }]);

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMessage,
        config: {
          systemInstruction: 'Eres un experto en mantenimiento predictivo industrial. Tus respuestas deben ser precisas, técnicas pero fáciles de entender. Ayudas a técnicos e ingenieros con dudas sobre termografía, ultrasonido, análisis de vibraciones, normativas ISO, tolerancias de equipos, y diagnóstico de fallas. Usa Markdown para formatear tus respuestas.',
          tools: [{ googleSearch: {} }]
        }
      });

      // Replace the temporary loading message with the actual response
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages.pop(); // Remove the "Searching..." message
        return [...newMessages, { role: 'model', text: response.text || 'No pude generar una respuesta.' }];
      });

    } catch (error: any) {
      console.error('Error calling Gemini API:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages.pop();
        return [...newMessages, { role: 'model', text: `Lo siento, ocurrió un error al procesar tu solicitud: ${error?.message || error}` }];
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
          <Bot className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Asistente de Mantenimiento IA</h2>
          <p className="text-xs text-zinc-500">Conectado a Google Search para datos actualizados</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-zinc-900 text-white' : 'bg-indigo-100 text-indigo-600'
            }`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 ${
              msg.role === 'user' 
                ? 'bg-zinc-900 text-white rounded-tr-sm' 
                : 'bg-zinc-50 border border-zinc-100 text-zinc-800 rounded-tl-sm'
            }`}>
              {msg.isSearching ? (
                <div className="flex items-center gap-2 text-zinc-500 text-sm">
                  <Search className="w-4 h-4 animate-pulse" />
                  Buscando en la web...
                </div>
              ) : (
                <div className="prose prose-sm prose-zinc max-w-none">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-zinc-100">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Pregunta sobre normativas, técnicas, tolerancias..."
            className="w-full pl-4 pr-12 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 p-2 text-zinc-400 hover:text-zinc-900 disabled:opacity-50 disabled:hover:text-zinc-400 transition-colors"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
