import React from 'react';
import AgentTraceSimulator from './components/AgentTrace';

const AgentTraceApp: React.FC = () => {
  return (
    <div className="bg-gray-900 text-white min-h-screen font-mono p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-300 mb-4 border-b border-gray-700 pb-2">
          Backend Agent Workflow Simulation
        </h1>
        <p className="text-gray-400 mb-6">
          This is a visual simulation of how a backend orchestrator might process a user's request. It breaks the query down, routes tasks to specialized agents (like a Knowledge Agent or Math Agent), uses tools, and synthesizes a final answer.
        </p>
        <AgentTraceSimulator />
      </div>
    </div>
  );
};

export default AgentTraceApp;