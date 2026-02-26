'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '👋 Здравей! Аз съм AI асистентът на Vitality Gym.\n\nМога да:\n• Отговарям на въпроси за служители, членове, смени, финанси\n• Добавям служители, смени, членове, транзакции\n• Генерирам KPIs и анализи\n\nПримери:\n"Добави служител Никол Симеонова, рецепция, 8.50 лв/час"\n"Кои членства изтичат тази седмица?"\n"Запиши разход 850 лв за оборудване на 24.02.2026"'
    }
  ])
  const [history, setHistory] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, history }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      setHistory(data.history || [])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Грешка — моля опитай отново.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center font-bold text-sm">V</div>
          <div>
            <h1 className="font-semibold text-white text-sm">Vitality Gym AI</h1>
            <p className="text-xs text-gray-400">Admin Assistant</p>
          </div>
        </div>
        <button
          onClick={() => { setMessages([{ role: 'assistant', content: '👋 Нов разговор започнат. С какво мога да помогна?' }]); setHistory([]) }}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Нов разговор
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-3xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center text-xs font-bold mr-2 mt-1 flex-shrink-0">V</div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-orange-500 text-white rounded-br-sm'
                : 'bg-gray-800 text-gray-100 rounded-bl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center text-xs font-bold mr-2 flex-shrink-0">V</div>
            <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-gray-400 flex items-center gap-1">
              <span className="animate-bounce">•</span>
              <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>•</span>
              <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>•</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      <div className="px-4 pb-2 max-w-3xl mx-auto w-full">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {[
            'Кой работи днес?',
            'Изтичащи абонаменти',
            'Приходи този месец',
            'Топ 10 клиенти',
            'Нови лийдове',
          ].map(q => (
            <button
              key={q}
              onClick={() => { setInput(q); }}
              className="flex-shrink-0 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-full px-3 py-1.5 transition-colors border border-gray-700"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="bg-gray-900 border-t border-gray-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Питай или давай команди на естествен език..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-5 py-3 text-sm font-medium transition-colors"
          >
            ↑
          </button>
        </div>
        <p className="text-center text-xs text-gray-600 mt-2">Vitality Gym OS • Admin</p>
      </div>

    </div>
  )
}