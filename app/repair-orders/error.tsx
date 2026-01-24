'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error('=== RO REPAIR ORDERS PAGE ERROR ===')
  console.error('Error message:', error.message)
  console.error('Error stack:', error.stack)
  console.error('Error digest:', error.digest)
  console.error('===================================')
  
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-4">Error Occurred</h2>
      <div className="bg-red-50 border border-red-200 p-4 rounded">
        <p className="font-mono text-sm mb-2">Message: {error.message}</p>
        <pre className="text-xs overflow-auto">{error.stack}</pre>
      </div>
      <button 
        onClick={() => reset()}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Try again
      </button>
    </div>
  )
}
