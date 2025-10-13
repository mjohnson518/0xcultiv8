import { useEffect, useRef, useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { RetroIconButton } from './RetroButton';

/**
 * RetroAgentTerminal Component
 * Black terminal window with green text for agent reasoning output
 * 
 * @example
 * <RetroAgentTerminal
 *   steps={[{
 *     timestamp: new Date(),
 *     model: 'claude',
 *     step: 'ANALYZE_MARKET',
 *     output: 'Market analysis complete...',
 *     status: 'complete'
 *   }]}
 * />
 */

export function RetroAgentTerminal({
  steps = [],
  title = 'AGENT EXECUTION LOG',
  maxHeight = '400px',
  showPrompt = true,
  onClear,
  className = '',
}) {
  const terminalRef = useRef(null);
  const [copied, setCopied] = useState(false);

  // Auto-scroll to bottom when new steps added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [steps]);

  const formatTimestamp = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getModelBadge = (model) => {
    const badges = {
      claude: { text: 'CLAUDE', color: 'text-purple-400' },
      gpt4: { text: 'GPT-4', color: 'text-blue-400' },
      system: { text: 'SYSTEM', color: 'text-white' },
    };
    return badges[model] || badges.system;
  };

  const getStatusSymbol = (status) => {
    const symbols = {
      running: '◐',
      complete: '●',
      error: '✗',
      pending: '○',
    };
    return symbols[status] || symbols.pending;
  };

  const handleCopy = async () => {
    const text = steps
      .map((step) => {
        const badge = getModelBadge(step.model);
        return `[${formatTimestamp(step.timestamp)}] [${badge.text}] ${step.step}\n${step.output}`;
      })
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  return (
    <div className={`border-2 border-green-500 ${className}`}>
      {/* Terminal Header */}
      <div className="bg-black text-green-500 px-3 py-2 border-b-2 border-green-500 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-pixel text-xs uppercase">▓▓▓ {title}</span>
        </div>
        <div className="flex items-center space-x-2">
          {copied ? (
            <span className="text-xs font-mono">COPIED!</span>
          ) : (
            <RetroIconButton
              icon={Copy}
              label="Copy terminal output"
              onClick={handleCopy}
              variant="default"
              className="bg-black text-green-500 border-green-500 hover:bg-green-500 hover:text-black w-8 h-8"
            />
          )}
          {onClear && (
            <RetroIconButton
              icon={Trash2}
              label="Clear terminal"
              onClick={onClear}
              variant="default"
              className="bg-black text-green-500 border-green-500 hover:bg-red-500 hover:border-red-500 w-8 h-8"
            />
          )}
        </div>
      </div>

      {/* Terminal Window */}
      <div
        ref={terminalRef}
        className="terminal-window font-mono text-sm overflow-y-auto"
        style={{ maxHeight }}
      >
        {steps.length === 0 ? (
          <div className="text-gray-600">
            <span className="blink">█</span> Awaiting agent execution...
          </div>
        ) : (
          steps.map((step, index) => {
            const badge = getModelBadge(step.model);
            const statusSymbol = getStatusSymbol(step.status);

            return (
              <div key={index} className="mb-4">
                {/* Step Header */}
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-gray-500 text-xs">
                    [{formatTimestamp(step.timestamp)}]
                  </span>
                  <span className={`text-xs ${badge.color}`}>
                    [{badge.text}]
                  </span>
                  <span className="text-green-500">
                    {statusSymbol} {step.step}
                  </span>
                </div>

                {/* Step Output */}
                <div className="pl-4 text-white whitespace-pre-wrap">
                  {step.output}
                </div>

                {/* Duration if available */}
                {step.duration && (
                  <div className="pl-4 text-gray-600 text-xs mt-1">
                    Completed in {step.duration}ms
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Terminal Prompt */}
        {showPrompt && (
          <div className="mt-2 flex items-center">
            <span className="text-green-500">root@cultiv8:~$</span>
            <span className="blink ml-1">█</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * RetroTerminalLine - Single line of terminal output
 */
export function RetroTerminalLine({ children, type = 'output', className = '' }) {
  const typeClasses = {
    output: 'text-white',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    error: 'text-red-500',
    info: 'text-blue-400',
  };

  return (
    <div className={`font-mono text-sm ${typeClasses[type]} ${className}`}>
      <span className="text-green-500">&gt; </span>
      {children}
    </div>
  );
}

