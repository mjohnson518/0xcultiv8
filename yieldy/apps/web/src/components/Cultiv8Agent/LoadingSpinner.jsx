import { Bot } from "lucide-react";

export function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Bot className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-pulse" />
        <p className="text-gray-600">Loading AI Agent...</p>
      </div>
    </div>
  );
}
