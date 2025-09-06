import React from 'react';
import Terminal from './components/Terminal';

const App: React.FC = () => {
  return (
    <div className="bg-gray-900 text-white min-h-screen font-mono">
      <Terminal />
    </div>
  );
};

export default App;