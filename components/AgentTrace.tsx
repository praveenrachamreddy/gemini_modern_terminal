import React, { useState, useEffect } from 'react';

// --- Helper Components for Richer UI ---

const Spinner: React.FC = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-400 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const Icon: React.FC<{ type: 'orchestrator' | 'agent' | 'tool' | 'response' }> = ({ type }) => {
    const icons = {
        orchestrator: { char: '🧠', color: 'text-purple-400', label: 'Orchestrator' },
        agent: { char: '🤖', color: 'text-cyan-400', label: 'Agent' },
        tool: { char: '🔧', color: 'text-yellow-400', label: 'Tool' },
        response: { char: '💬', color: 'text-green-400', label: 'Final Answer' },
    };
    const { char, color, label } = icons[type];
    return <span className={`mr-2 ${color}`} title={label}>{char}</span>;
}

// --- Main Simulation Component ---

interface TraceLine {
  id: number;
  type: 'orchestrator' | 'agent' | 'tool' | 'response';
  indent: number;
  text: string;
  status?: 'thinking' | 'done';
}

const AgentTraceSimulator: React.FC = () => {
  const [trace, setTrace] = useState<TraceLine[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const command = "What is the capital of France and what is the result of 12 * 5?";

  useEffect(() => {
    const steps: Omit<TraceLine, 'id'>[] = [
      { type: 'orchestrator', indent: 0, text: `Received request: "${command}"`, status: 'thinking' },
      { type: 'orchestrator', indent: 0, text: 'Breaking down request into sub-tasks.' },
      { type: 'orchestrator', indent: 1, text: 'Routing "Capital of France" to KnowledgeAgent.', status: 'thinking' },
      { type: 'agent', indent: 2, text: 'KnowledgeAgent received task.', status: 'thinking' },
      { type: 'agent', indent: 2, text: 'Using SearchTool for "Capital of France".' },
      { type: 'tool', indent: 3, text: 'SearchTool returned: "Paris".' },
      { type: 'agent', indent: 2, text: 'KnowledgeAgent task complete.' },
      { type: 'orchestrator', indent: 1, text: 'Received result "Paris" from KnowledgeAgent.' },
      { type: 'orchestrator', indent: 1, text: 'Routing "12 * 5" to MathAgent.', status: 'thinking' },
      { type: 'agent', indent: 2, text: 'MathAgent received task.', status: 'thinking' },
      { type: 'agent', indent: 2, text: 'Using CalculatorTool with inputs: 12, 5, multiply.' },
      { type: 'tool', indent: 3, text: 'CalculatorTool returned: "60".' },
      { type: 'agent', indent: 2, text: 'MathAgent task complete.' },
      { type: 'orchestrator', indent: 1, text: 'Received result "60" from MathAgent.' },
      { type: 'orchestrator', indent: 0, text: 'All sub-tasks complete. Synthesizing final response.', status: 'thinking' },
      { type: 'response', indent: 0, text: 'The capital of France is Paris, and 12 * 5 is 60.' },
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        // Mark previous "thinking" step as "done"
        setTrace(prev => prev.map(line => line.status === 'thinking' ? { ...line, status: 'done' } : line));

        // Add the new step
        setTrace(prev => [...prev, { ...steps[currentStep], id: currentStep }]);
        currentStep++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, 800); // Delay between steps

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gray-800/50 p-4 rounded-md my-1 border border-gray-700 font-mono text-sm text-gray-200">
      <div className="border-b border-gray-600 pb-2 mb-2 text-gray-400 flex items-center">
        {isComplete ? '✅' : <Spinner />}
        <span className="ml-2 font-bold">Agent Execution Trace</span>
      </div>
      <div className="space-y-1">
        {trace.map(line => (
          <div key={line.id} style={{ paddingLeft: `${line.indent * 1.5}rem` }} className="flex items-start">
             <div><Icon type={line.type} /></div>
             <div className="flex-1">
                <span className={line.type === 'response' ? 'text-green-300 font-semibold' : ''}>{line.text}</span>
                {line.status === 'thinking' && <Spinner />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentTraceSimulator;
