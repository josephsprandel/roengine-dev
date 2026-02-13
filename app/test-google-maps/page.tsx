"use client"

export default function TestGoogleMaps() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Google Maps API Diagnostics</h1>
      
      <div className="space-y-4">
        <div className="bg-white border p-4 rounded">
          <h2 className="font-semibold">API Key Status:</h2>
          <p className={apiKey ? "text-green-600" : "text-red-600"}>
            {apiKey ? `✓ Key loaded: ${apiKey.substring(0, 25)}...` : "✗ No API key found"}
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
          <h2 className="font-semibold mb-2">⚠️ Common Issues & Solutions:</h2>
          <ol className="list-decimal list-inside space-y-3 text-sm">
            <li className="font-medium">Places API Not Enabled
              <div className="ml-6 mt-1 text-gray-700">
                → <a href="https://console.cloud.google.com/apis/library/places-backend.googleapis.com" className="text-blue-600 underline" target="_blank">Enable Places API</a>
              </div>
            </li>
            <li className="font-medium">Billing Not Enabled (Required!)
              <div className="ml-6 mt-1 text-gray-700">
                → <a href="https://console.cloud.google.com/billing" className="text-blue-600 underline" target="_blank">Enable Billing</a>
                <br/>→ Google requires billing even for free tier
              </div>
            </li>
            <li className="font-medium">API Key Restrictions Too Strict
              <div className="ml-6 mt-1 text-gray-700">
                → <a href="https://console.cloud.google.com/apis/credentials" className="text-blue-600 underline" target="_blank">Edit API Key</a>
                <br/>→ Set <strong>Application restrictions: None</strong>
                <br/>→ Set <strong>API restrictions: Don't restrict key</strong>
              </div>
            </li>
          </ol>
        </div>

        <div className="bg-green-50 border border-green-200 p-4 rounded">
          <h2 className="font-semibold mb-2">✅ Quick Fix Steps:</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Go to <a href="https://console.cloud.google.com/apis/credentials" className="text-blue-600 underline" target="_blank">Google Cloud Credentials</a></li>
            <li>Click your API key: <code className="bg-white px-1">{apiKey?.substring(0, 25)}...</code></li>
            <li>Under "Application restrictions" → Select <strong>"None"</strong></li>
            <li>Under "API restrictions" → Select <strong>"Don't restrict key"</strong></li>
            <li>Click <strong>Save</strong></li>
            <li>Wait 1-2 minutes for changes to propagate</li>
            <li>Refresh your customer creation page</li>
          </ol>
        </div>

        <div className="bg-blue-50 border border-blue-200 p-4 rounded text-sm">
          <h2 className="font-semibold mb-2">📝 After Testing:</h2>
          <p>Once autocomplete works, secure your key by adding restrictions:</p>
          <ul className="list-disc list-inside ml-2 mt-2 space-y-1">
            <li>HTTP referrers: <code>arologik.com/*</code>, <code>localhost:3000/*</code></li>
            <li>API restrictions: Places API only</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
