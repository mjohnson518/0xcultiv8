'use client';

import { Brain, Lightbulb, Target, Wrench, Zap } from 'lucide-react';

/**
 * Reasoning Chain Display Component
 * Shows the agent's decision-making process
 */
export function ReasoningChain({ steps }) {
  const getStepIcon = (stepName) => {
    if (stepName.includes('analyze') || stepName.includes('analysis')) {
      return <Brain className="w-4 h-4" />;
    }
    if (stepName.includes('generate') || stepName.includes('strategy')) {
      return <Lightbulb className="w-4 h-4" />;
    }
    if (stepName.includes('select')) {
      return <Target className="w-4 h-4" />;
    }
    if (stepName.includes('plan')) {
      return <Wrench className="w-4 h-4" />;
    }
    if (stepName.includes('execute')) {
      return <Zap className="w-4 h-4" />;
    }
    return <div className="w-4 h-4 bg-gray-400 rounded-full" />;
  };

  const getModelBadge = (model) => {
    if (!model) return null;

    if (model.includes('claude')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300">
          Claude Sonnet 4.5
        </span>
      );
    }

    if (model.includes('gpt')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
          GPT-4 Turbo
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300">
        {model}
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Reasoning Chain</h4>

      <div className="space-y-4">
        {steps.map((step, i) => (
          <div
            key={i}
            className="relative pl-8 pb-4 border-l-2 border-gray-200 dark:border-gray-700 last:border-l-0 last:pb-0"
          >
            {/* Icon */}
            <div className="absolute left-0 top-0 -ml-2.5 w-5 h-5 bg-white dark:bg-gray-800 flex items-center justify-center">
              <div className="bg-emerald-600 rounded-full p-1">
                {getStepIcon(step.step)}
                <div className="text-white w-full h-full flex items-center justify-center">
                  {getStepIcon(step.step)}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-gray-900 dark:text-white capitalize">
                  {step.step.replace(/_/g, ' ')}
                </p>
                {getModelBadge(step.model)}
              </div>

              <div className="text-sm text-gray-700 dark:text-gray-300">
                {typeof step.output === 'string' ? (
                  <p className="whitespace-pre-wrap">{step.output.substring(0, 300)}{step.output.length > 300 ? '...' : ''}</p>
                ) : (
                  <pre className="overflow-x-auto text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded">
                    {JSON.stringify(step.output, null, 2).substring(0, 400)}
                  </pre>
                )}
              </div>

              {step.duration && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Completed in {step.duration}ms
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
