import ChatInterface from '@/components/signal/ChatInterface';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <header className="flex-shrink-0 border-b border-slate-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-baseline gap-3">
          <h1 className="text-base font-semibold tracking-widest uppercase text-white">
            Signal
          </h1>
          <span className="text-sm text-slate-500">UAP Document Intelligence</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0">
        <ChatInterface />
      </main>
    </div>
  );
}
