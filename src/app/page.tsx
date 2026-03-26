import Image from 'next/image';
import ChatInterface from '@/components/signal/ChatInterface';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <header className="flex-shrink-0 px-6 pt-10 pb-6">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-3">
          <Image
            src="/assets/signal-icon.png"
            alt="Signal"
            width={120}
            height={120}
            priority
          />
          <h1 className="text-4xl font-semibold tracking-wide text-white">
            Signal
          </h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0">
        <ChatInterface />
      </main>
    </div>
  );
}
