export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4">AI Knowledge Base</h1>
        <p className="text-lg">
          Welcome to the AI Knowledge Base - Phase 1: Project Initialization Complete
        </p>
        <div className="mt-8 p-4 border border-gray-300 rounded-lg">
          <h2 className="text-2xl font-semibold mb-2">Next Steps:</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Configure your OpenAI API key in .env.local</li>
            <li>Start implementing Plan 01: Foundation</li>
            <li>Build authentication and workspace features</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
