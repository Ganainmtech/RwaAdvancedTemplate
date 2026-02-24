import TokenizeAsset from './components/TokenizeWorkspace'

/**
 * Tokenize Page
 * Main page for creating new Algorand Standard Assets (ASAs)
 */
export default function TokenizePage() {
  return (
    <div className="bg-white dark:bg-slate-950 min-h-screen py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <TokenizeAsset />
      </div>
    </div>
  )
}
