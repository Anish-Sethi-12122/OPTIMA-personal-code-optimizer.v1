import { useState, useRef, useEffect } from 'react';
import { ModelCategory } from '@runanywhere/web';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import { useModelLoader } from '../hooks/useModelLoader';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export function FloatingChatAgent() {
  const loader = useModelLoader(ModelCategory.Language);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || generating) return;

    if (loader.state !== 'ready') {
      const ok = await loader.ensure();
      if (!ok) return;
    }

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setGenerating(true);

    const assistantIdx = messages.length + 1;
    setMessages(prev => [...prev, { role: 'assistant', text: '' }]);

    try {
      const { stream } = await TextGeneration.generateStream(text, {
        maxTokens: 300,
        temperature: 0.7,
      });

      let accumulated = '';
      for await (const token of stream) {
        accumulated += token;
        setMessages(prev => {
          const updated = [...prev];
          updated[assistantIdx] = { role: 'assistant', text: accumulated };
          return updated;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(prev => {
        const updated = [...prev];
        updated[assistantIdx] = { role: 'assistant', text: `Error: ${msg}` };
        return updated;
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button className="floating-chat-btn" onClick={() => setIsOpen(true)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </button>
      )}

      {/* Floating Chat Box */}
      {isOpen && (
        <div className="floating-chat-box">
          <div className="floating-chat-header">
            <div className="floating-chat-title">
              <span>💬 Chat Assistant</span>
              {loader.state === 'ready' && <span className="status-dot"></span>}
            </div>
            <button className="close-btn" onClick={() => setIsOpen(false)}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 5L5 15M5 5l10 10" />
              </svg>
            </button>
          </div>

          <div className="floating-chat-messages">
            {messages.length === 0 && (
              <div className="floating-empty-state">
                <p>Ask me anything!</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`floating-message floating-message-${msg.role}`}>
                {msg.role === 'assistant' && generating && i === messages.length - 1 ? (
                  <>
                    {msg.text ? (
                      <span className="floating-message-streaming">
                        {msg.text}
                        <span className="chat-cursor" />
                      </span>
                    ) : (
                      <div className="chat-typing-indicator">
                        <span className="chat-typing-dot" />
                        <span className="chat-typing-dot" />
                        <span className="chat-typing-dot" />
                      </div>
                    )}
                  </>
                ) : (
                  msg.text || (msg.role === 'assistant' ? '...' : '')
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="floating-chat-input">
            <button 
              className={`voice-toggle-btn ${voiceMode ? 'active' : ''}`}
              onClick={() => setVoiceMode(!voiceMode)}
              title="Voice input (coming soon)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 003 3v7a3 3 0 01-6 0V4a3 3 0 003-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
              </svg>
            </button>
            <input
              type="text"
              placeholder="Type your message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={generating}
            />
            <button 
              className="send-btn" 
              onClick={sendMessage}
              disabled={!input.trim() || generating}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
