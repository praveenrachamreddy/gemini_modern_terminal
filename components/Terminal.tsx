import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Line, LineType, Source } from '../types';
import {
  PROMPT_SYMBOL,
  USERNAME,
  HOSTNAME,
  WELCOME_LINES,
  HELP_TEXT,
  ABOUT_TEXT,
  NEOFETCH_ASCII,
  COMMANDS,
} from '../constants';
import { 
    askGeminiStream, 
    startChat, 
    sendChatMessageStream, 
    generateCode, 
    generateImage, 
    searchWithGoogleStream, 
    startChatDoc, 
    sendChatDocMessageStream, 
    editImage,
    generateVideo,
    getVideosOperation,
} from '../services/geminiService';
import type { Operation } from '@google/genai';

// Fix: Added type definitions for the Web Speech API (SpeechRecognition) to resolve TypeScript errors.
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionStatic {
  new(): SpeechRecognition;
}

declare var SpeechRecognition: SpeechRecognitionStatic;
declare var webkitSpeechRecognition: SpeechRecognitionStatic;

// Add SpeechRecognition types for cross-browser compatibility
interface IWindow extends Window {
  SpeechRecognition: typeof SpeechRecognition;
  webkitSpeechRecognition: typeof webkitSpeechRecognition;
}

const CodeBlock: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset button text after 2 seconds
  };

  return (
    <div className="relative bg-gray-800/50 p-4 rounded-md my-1 border border-gray-700 font-mono text-sm text-gray-200">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-xs text-gray-300 transition-colors"
        aria-label="Copy code to clipboard"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre>
        <code className="whitespace-pre-wrap break-words">{code}</code>
      </pre>
    </div>
  );
};

const ImageOutput: React.FC<{ base64: string, prompt: string }> = ({ base64, prompt }) => {
    const imageUrl = `data:image/png;base64,${base64}`;
    const filename = `${prompt.substring(0, 30).replace(/\s/g, '_')}.png`;

    return (
        <div className="relative group bg-gray-900/70 p-2 rounded-md my-1 border border-gray-700 max-w-md">
            <img src={imageUrl} alt={prompt} className="rounded" />
            <a
                href={imageUrl}
                download={filename}
                className="absolute top-2 right-2 px-2 py-1 bg-gray-800/80 hover:bg-gray-700 rounded-md text-xs text-gray-200 transition-opacity opacity-0 group-hover:opacity-100"
                aria-label="Download image"
            >
                Download
            </a>
        </div>
    );
};

const VideoOutput: React.FC<{ src: string, prompt: string }> = ({ src, prompt }) => {
    const filename = `${prompt.substring(0, 30).replace(/\s/g, '_')}.mp4`;

    return (
        <div className="relative group bg-gray-900/70 p-2 rounded-md my-1 border border-gray-700 max-w-md">
            <video
                src={src}
                controls
                autoPlay
                loop
                muted
                playsInline
                className="rounded"
                aria-label={`Generated video for prompt: ${prompt}`}
            />
            <a
                href={src}
                download={filename}
                className="absolute top-2 right-2 px-2 py-1 bg-gray-800/80 hover:bg-gray-700 rounded-md text-xs text-gray-200 transition-opacity opacity-0 group-hover:opacity-100"
                aria-label="Download video"
            >
                Download
            </a>
        </div>
    );
};

const SourcesOutput: React.FC<{ sources: Source[] }> = ({ sources }) => {
    return (
        <div className="mt-2">
            <h3 className="text-sm text-gray-400 font-bold">Sources:</h3>
            <ul className="list-disc list-inside text-sm">
                {sources.map((source, index) => (
                    <li key={index} className="truncate">
                        <a 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-400 hover:underline"
                            title={source.uri}
                        >
                            {source.title}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
};


const Terminal: React.FC = () => {
  const [lines, setLines] = useState<Line[]>(WELCOME_LINES);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isChatMode, setIsChatMode] = useState(false);
  const [isChatDocMode, setIsChatDocMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [documents, setDocuments] = useState<Record<string, string>>({});
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [lastImage, setLastImage] = useState<string | null>(null);


  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  // Effect for the live clock
  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  // Effect for initializing Speech Recognition
  useEffect(() => {
    const { SpeechRecognition, webkitSpeechRecognition } = (window as unknown as IWindow);
    const SpeechRecognitionAPI = SpeechRecognition || webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn("Speech Recognition API is not supported by this browser.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onerror = (event) => {
      let errorText = `Speech recognition error: ${event.error}. Please try again.`;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        errorText = "Microphone access denied. Please allow microphone permissions in your browser settings to use this feature.";
      }
      setLines(prev => [...prev, { type: LineType.ERROR, text: errorText }]);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputValue(transcript);
    };

    recognitionRef.current = recognition;
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [lines, suggestions, isLoading]);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const handleToggleListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
    } else {
      setInputValue(''); // Clear input before starting
      recognition.start();
    }
  };
  
  const handleChat = async (message: string) => {
    if (message.toLowerCase() === 'exit') {
        setIsChatMode(false);
        setLines(prev => [...prev, { type: LineType.SYSTEM, text: 'Exited chat mode.'}]);
        return;
    }
    setIsLoading(true);
    setLines(prev => [...prev, { type: LineType.OUTPUT, text: '' }]);
    
    let streamedText = "";
    try {
        for await (const chunk of sendChatMessageStream(message)) {
            streamedText += chunk;
            setLines(prev => {
                const newLines = [...prev];
                newLines[newLines.length - 1].text = streamedText;
                return newLines;
            });
        }
    } finally {
        setLines(prev => {
            const newLines = [...prev];
            newLines[newLines.length - 1].text = streamedText.split('\n');
            return newLines;
        });
        setIsLoading(false);
    }
  };

  const handleChatDocConversation = async (message: string) => {
    if (message.toLowerCase() === 'exit') {
        setIsChatDocMode(false);
        setLines(prev => [...prev, { type: LineType.SYSTEM, text: 'Exited document chat mode.' }]);
        return;
    }
    setIsLoading(true);
    setLines(prev => [...prev, { type: LineType.OUTPUT, text: '' }]);
    
    let streamedText = "";
    try {
        for await (const chunk of sendChatDocMessageStream(message)) {
            streamedText += chunk;
            setLines(prev => {
                const newLines = [...prev];
                newLines[newLines.length - 1].text = streamedText;
                return newLines;
            });
        }
    } finally {
        setLines(prev => {
            const newLines = [...prev];
            newLines[newLines.length - 1].text = streamedText.split('\n');
            return newLines;
        });
        setIsLoading(false);
    }
  };

  const handleAsk = async (prompt: string) => {
    setIsLoading(true);
    // Add a placeholder line for the streaming response
    setLines(prev => [...prev, { type: LineType.OUTPUT, text: '' }]);
    
    let streamedText = "";
    try {
        for await (const chunk of askGeminiStream(prompt)) {
            streamedText += chunk;
            // Update the last line with the new chunk
            setLines(prev => {
                const newLines = [...prev];
                newLines[newLines.length - 1].text = streamedText;
                return newLines;
            });
        }
    } finally {
        // After streaming, split the full response into lines for proper display
        setLines(prev => {
            const newLines = [...prev];
            newLines[newLines.length - 1].text = streamedText.split('\n');
            return newLines;
        });
        setIsLoading(false);
    }
  };

  const handleSearch = async (prompt: string) => {
    setIsLoading(true);
    setLines(prev => [...prev, { type: LineType.OUTPUT, text: '' }]);
    
    let streamedText = "";
    try {
        for await (const event of searchWithGoogleStream(prompt)) {
            if (event.type === 'chunk') {
                streamedText += event.text;
                setLines(prev => {
                    const newLines = [...prev];
                    const lastLine = newLines[newLines.length - 1];
                    if (lastLine.type === LineType.OUTPUT) {
                        lastLine.text = streamedText;
                    }
                    return newLines;
                });
            } else if (event.type === 'sources') {
                 setLines(prev => {
                    const newLines = [...prev];
                    // Finalize the text output line before adding sources
                    const lastLine = newLines[newLines.length - 1];
                    if (lastLine.type === LineType.OUTPUT) {
                         lastLine.text = streamedText.split('\n');
                    }
                    // Add new line for sources
                    return [...newLines, { type: LineType.SOURCES, text: '', sources: event.sources }];
                });
            }
        }
    } finally {
        setLines(prev => {
            const newLines = [...prev];
            const lastLine = newLines[newLines.length - 1];
            // Ensure the last text update is split into lines if sources weren't found
            if (lastLine.type === LineType.OUTPUT) {
                lastLine.text = streamedText.split('\n');
            }
            return newLines;
        });
        setIsLoading(false);
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (file.type && !file.type.startsWith('text/')) {
             setLines(prev => [...prev, { type: LineType.ERROR, text: `Error: Cannot upload file of type '${file.type}'. Please select a text file.` }]);
             return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            setDocuments(prev => ({ ...prev, [file.name]: content }));
            
            // If it's the first document, make it active
            if (!activeDoc) {
                setActiveDoc(file.name);
            }

            const successMessage = `Successfully loaded '${file.name}' (${content.length} characters).`;
            const usageMessage = "Use `docs list` to see all files or `chatdoc` to start a conversation.";
            setLines(prev => [
                ...prev,
                { type: LineType.SYSTEM, text: successMessage },
                { type: LineType.SYSTEM, text: usageMessage }
            ]);
        };
        reader.onerror = () => {
             setLines(prev => [...prev, { type: LineType.ERROR, text: `Error reading file: ${reader.error}` }]);
        };
        reader.readAsText(file);
    }
    // Reset file input value to allow uploading the same file again
    if(event.target) {
        event.target.value = '';
    }
  };


  const processCommand = useCallback(async (commandStr: string) => {
    const [command, ...args] = commandStr.trim().split(' ').filter(Boolean);
    let outputLines: Line[] = [];

    if (!command) {
      setLines(prev => [...prev]);
      return;
    }

    switch (command.toLowerCase()) {
      case 'help':
        outputLines.push({ type: LineType.OUTPUT, text: HELP_TEXT });
        break;
      
      case 'clear':
        setLines([]);
        return;
        
      case 'chat':
        if (isChatDocMode) {
          outputLines.push({ type: LineType.ERROR, text: 'Already in document chat mode. Type `exit` to leave first.' });
          break;
        }
        setIsChatMode(true);
        startChat();
        outputLines.push({ type: LineType.SYSTEM, text: "Entered chat mode. Type 'exit' to leave."});
        break;

      case 'ask':
        {
          const prompt = args.join(' ');
          if (!prompt) {
            outputLines.push({ type: LineType.ERROR, text: 'Usage: ask <your question>' });
            setLines(prev => [...prev, ...outputLines]);
          } else {
            await handleAsk(prompt);
          }
        }
        return;

      case 'search':
        {
          const prompt = args.join(' ');
          if (!prompt) {
            outputLines.push({ type: LineType.ERROR, text: 'Usage: search <your question>' });
            setLines(prev => [...prev, ...outputLines]);
          } else {
            await handleSearch(prompt);
          }
        }
        return;
      
      case 'code':
        {
          const prompt = args.join(' ');
          if (!prompt) {
            outputLines.push({ type: LineType.ERROR, text: 'Usage: code <your coding question>' });
          } else {
            setIsLoading(true);
            const aiResponse = await generateCode(prompt);
            if (aiResponse.explanation) {
              outputLines.push({ type: LineType.OUTPUT, text: aiResponse.explanation.split('\n') });
            }
            if (aiResponse.code) {
              outputLines.push({ type: LineType.CODE, text: aiResponse.code });
            }
            setIsLoading(false);
          }
        }
        break;
        
      case 'image':
        {
          const prompt = args.join(' ');
          if (!prompt) {
            outputLines.push({ type: LineType.ERROR, text: 'Usage: image <a description of the image>' });
          } else {
            setIsLoading(true);
            const base64Image = await generateImage(prompt);
            if (base64Image.startsWith('Error:')) {
                outputLines.push({ type: LineType.ERROR, text: base64Image });
            } else {
                outputLines.push({ type: LineType.IMAGE, text: [base64Image, prompt] });
                setLastImage(base64Image);
            }
            setIsLoading(false);
          }
        }
        break;

      case 'editimg':
        {
            const prompt = args.join(' ');
            if (!prompt) {
                outputLines.push({ type: LineType.ERROR, text: 'Usage: editimg <your edit instruction>' });
            } else if (!lastImage) {
                outputLines.push({ type: LineType.ERROR, text: 'No image to edit. Use the `image` command to generate one first.' });
            } else {
                setIsLoading(true);
                const response = await editImage(lastImage, prompt);

                if (response.text) {
                    outputLines.push({ type: LineType.OUTPUT, text: response.text.split('\n') });
                }

                if (response.image) {
                    outputLines.push({ type: LineType.IMAGE, text: [response.image, prompt] });
                    setLastImage(response.image);
                } else if (!response.text) {
                    outputLines.push({ type: LineType.ERROR, text: 'The AI did not return a valid response.' });
                }
                
                setIsLoading(false);
            }
        }
        break;
      
      case 'video':
        {
            const prompt = args.join(' ');
            if (!prompt) {
                outputLines.push({ type: LineType.ERROR, text: 'Usage: video <a description of the video>' });
                setLines(prev => [...prev, ...outputLines]);
                return;
            }
            
            setIsLoading(true);
            setLines(prev => [
                ...prev,
                { type: LineType.SYSTEM, text: `Kicking off video generation for: "${prompt}"`},
                { type: LineType.SYSTEM, text: `This can take a few minutes. Status will be checked periodically.`},
            ]);

            try {
                // Fix: Use a const for the initial result to help TypeScript's control flow analysis.
                // The mutable `let operation` was causing TS to incorrectly widen the type within the
                // `setLines` closure, as it couldn't guarantee the variable hadn't been changed.
                const operationResult = await generateVideo(prompt);

                if (typeof operationResult === 'string') { // Handle initial error
                    setLines(prev => [...prev, { type: LineType.ERROR, text: operationResult }]);
                    setIsLoading(false);
                    return;
                }
                
                let operation = operationResult;
                let pollCount = 0;
                const pollMessages = [
                    "Still processing... The AI is animating the frames.",
                    "Still processing... Polishing the final cut.",
                    "Still processing... This is taking longer than usual, but we're still on it!",
                ];

                while (!operation.done) {
                    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
                    
                    const message = pollMessages[Math.min(pollCount, pollMessages.length - 1)];
                    setLines(prev => [...prev, { type: LineType.SYSTEM, text: message }]);
                    
                    operation = await getVideosOperation(operation);
                    pollCount++;
                }

                const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
                if (downloadLink) {
                    setLines(prev => [...prev, { type: LineType.SYSTEM, text: 'Video generated! Downloading and preparing for playback...' }]);
                    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                    const blob = await response.blob();
                    const objectUrl = URL.createObjectURL(blob);
                    setLines(prev => [...prev, { type: LineType.VIDEO, text: [objectUrl, prompt] }]);
                } else {
                    setLines(prev => [...prev, { type: LineType.ERROR, text: 'Video generation finished, but no video was returned. Please try a different prompt.' }]);
                }

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during video generation.";
                setLines(prev => [...prev, { type: LineType.ERROR, text: `Error: ${errorMessage}` }]);
            } finally {
                setIsLoading(false);
            }
        }
        return;

      case 'upload':
        fileInputRef.current?.click();
        break;
      
      case 'docs':
        {
          const subCommand = args[0];
          switch (subCommand) {
            case 'list':
              const docKeys = Object.keys(documents);
              if (docKeys.length === 0) {
                outputLines.push({ type: LineType.OUTPUT, text: 'No documents uploaded.' });
              } else {
                outputLines.push({ type: LineType.OUTPUT, text: 'Uploaded documents:' });
                const docList = docKeys.map(name => `  ${name === activeDoc ? '*' : ' '} ${name}`);
                outputLines.push({ type: LineType.OUTPUT, text: docList });
              }
              break;
            case 'select':
              const docToSelect = args[1];
              if (!docToSelect) {
                outputLines.push({ type: LineType.ERROR, text: 'Usage: docs select <filename>' });
              } else if (documents[docToSelect]) {
                setActiveDoc(docToSelect);
                outputLines.push({ type: LineType.SYSTEM, text: `Active document set to '${docToSelect}'.` });
              } else {
                outputLines.push({ type: LineType.ERROR, text: `Document '${docToSelect}' not found.` });
              }
              break;
            case 'clear':
              setDocuments({});
              setActiveDoc(null);
              outputLines.push({ type: LineType.SYSTEM, text: 'All documents cleared.' });
              break;
            default:
              outputLines.push({ type: LineType.ERROR, text: 'Usage: docs <list|select|clear>' });
          }
        }
        break;

      case 'chatdoc':
        if (isChatMode) {
            outputLines.push({ type: LineType.ERROR, text: 'Already in regular chat mode. Type `exit` to leave first.' });
        } else if (!activeDoc) {
            outputLines.push({ type: LineType.ERROR, text: 'No active document. Use `docs select <filename>` or `upload` a new file.' });
        } else if (args.length > 0) {
            outputLines.push({ type: LineType.ERROR, text: 'Usage: type `chatdoc` and press Enter to start a conversation.' });
        } else {
            startChatDoc(documents[activeDoc]);
            setIsChatDocMode(true);
            outputLines.push({ type: LineType.SYSTEM, text: `Entered chat mode for '${activeDoc}'. Type 'exit' to leave.` });
        }
        break;

      case 'date':
        outputLines.push({ type: LineType.OUTPUT, text: new Date().toString() });
        break;
      
      case 'whoami':
        outputLines.push({ type: LineType.OUTPUT, text: USERNAME });
        break;
      
      case 'about':
        outputLines.push({ type: LineType.OUTPUT, text: ABOUT_TEXT });
        break;

      case 'neofetch':
        const neofetchLines = NEOFETCH_ASCII.split('\n').map((line, index) => {
            if (index === 2) return `${line}    ${USERNAME}@${HOSTNAME}`;
            if (index === 3) return `${line}    -----------------`;
            if (index === 4) return `${line}    OS: Gemini Web Terminal`;
            if (index === 5) return `${line}    Kernel: React ${React.version}`;
            if (index === 6) return `${line}    Shell: TypeScript`;
            if (index === 7) return `${line}    Theme: DarkModern`;
            return line;
        });
        outputLines.push({ type: LineType.OUTPUT, text: neofetchLines });
        break;

      default:
        outputLines.push({ type: LineType.ERROR, text: `command not found: ${command}` });
        break;
    }
    
    setLines(prev => [...prev, ...outputLines]);

  }, [documents, activeDoc, isChatMode, isChatDocMode, lastImage]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (suggestions.length > 0) {
      setSuggestions([]);
    }
    
    if (isLoading || isListening) return;
    
    const command = inputValue.trim();
    const lineType = isChatMode || isChatDocMode ? LineType.SYSTEM : LineType.COMMAND;
    setLines(prev => [...prev, { type: lineType, text: command || '' }]);
    
    if (!command && (isChatMode || isChatDocMode)) {
        return;
    }
    if (!command) {
        setInputValue('');
        return;
    }

    if (isChatMode) {
      await handleChat(command);
    } else if (isChatDocMode) {
      await handleChatDocConversation(command);
    }
    else {
      setCommandHistory(prev => [command, ...prev]);
      setHistoryIndex(-1);
      await processCommand(command);
    }
    
    setInputValue('');
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (suggestions.length > 0) {
      setSuggestions([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const inAnyChatMode = isChatMode || isChatDocMode;
    if (e.key === 'ArrowUp' && !inAnyChatMode) {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown' && !inAnyChatMode) {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      } else {
        setHistoryIndex(-1);
        setInputValue('');
      }
    } else if (e.key === 'Tab' && !inAnyChatMode) {
      e.preventDefault();
      const currentInput = inputValue.trim().split(' ')[0];
      if (!currentInput) return;

      const matches = COMMANDS.filter(cmd => cmd.startsWith(currentInput));

      if (matches.length === 1) {
        setInputValue(matches[0] + ' ');
        setSuggestions([]);
      } else if (matches.length > 1) {
        setSuggestions(matches);
      }
    }
  };
  
  const renderLineText = (text: string | string[], type: LineType) => {
    const colorClass = 
        type === LineType.ERROR ? 'text-red-400' :
        type === LineType.SYSTEM ? 'text-green-400' :
        'text-gray-300';
    
    if (Array.isArray(text)) {
      return text.map((line, index) => (
        <div key={index} className={`whitespace-pre-wrap ${colorClass}`}>{line}</div>
      ));
    }
    return <div className={`whitespace-pre-wrap ${colorClass}`}>{text}</div>;
  };
  
  const renderPrompt = () => {
    const docName = activeDoc ? `[${activeDoc}] ` : '';
    if (isChatDocMode) {
      return (
        <>
            <span className="text-purple-500">[doc]</span>
            <span className="text-green-500 ml-2">{PROMPT_SYMBOL}</span>
        </>
      );
    }
    if (isChatMode) {
      return (
        <>
            <span className="text-yellow-500">[chat]</span>
            <span className="text-green-500 ml-2">{PROMPT_SYMBOL}</span>
        </>
      );
    }
    return (
      <>
        <span className="text-green-500">{PROMPT_SYMBOL}</span>
        <span className="text-cyan-500 ml-2">{docName}</span>
        <span className="text-blue-500">{`${USERNAME}@${HOSTNAME}`}</span>
        <span className="text-gray-300 ml-1">:~$</span>
      </>
    );
  };

  const time = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const date = currentTime.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  
  return (
    <div 
      className="w-full h-screen bg-gray-900 flex flex-col rounded-lg border border-gray-700/50 shadow-2xl shadow-black/50"
      onClick={focusInput}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="text/*,.md,.json,.js,.ts,.html,.css"
      />
      {/* Terminal Header */}
      <div className="flex-shrink-0 h-8 grid grid-cols-[1fr_auto_1fr] items-center px-3 bg-gray-800 border-b border-gray-700 rounded-t-lg">
        <div className="flex items-center space-x-2">
          <span className="h-3 w-3 rounded-full bg-red-500" aria-hidden="true"></span>
          <span className="h-3 w-3 rounded-full bg-yellow-500" aria-hidden="true"></span>
          <span className="h-3 w-3 rounded-full bg-green-500" aria-hidden="true"></span>
        </div>
        <div className="text-center text-sm text-gray-400 font-medium">
          {USERNAME}@{HOSTNAME}
        </div>
        <div className="text-right text-xs text-gray-500 whitespace-nowrap">
            {`${date} ${time}`}
        </div>
      </div>

      {/* Terminal Body */}
      <div ref={scrollContainerRef} className="flex-grow p-4 overflow-y-auto text-sm">
        {lines.map((line, index) => (
          <div key={index} className="mb-1">
            {line.type === LineType.COMMAND ? (
              <div className="flex items-center">
                {renderPrompt()}
                <span className="ml-2 flex-1 text-gray-200">{line.text}</span>
              </div>
            ) : line.type === LineType.SYSTEM && (isChatMode || isChatDocMode) ? (
                <div className="flex items-center">
                    {renderPrompt()}
                    <span className="ml-2 flex-1 text-gray-200">{line.text}</span>
                </div>
            ) : line.type === LineType.CODE ? (
                <CodeBlock code={line.text as string} />
            ) : line.type === LineType.IMAGE ? (
                <ImageOutput base64={Array.isArray(line.text) ? line.text[0] : ''} prompt={Array.isArray(line.text) ? line.text[1] : ''} />
            ) : line.type === LineType.VIDEO ? (
                <VideoOutput src={Array.isArray(line.text) ? line.text[0] : ''} prompt={Array.isArray(line.text) ? line.text[1] : ''} />
            ) : line.type === LineType.SOURCES && line.sources ? (
                <SourcesOutput sources={line.sources} />
            ) : (
                renderLineText(line.text, line.type)
            )}
          </div>
        ))}

        <form onSubmit={handleSubmit}>
          <div className="flex items-center">
            {renderPrompt()}
            <div className="relative flex-1 ml-2 flex items-center">
                <span className="whitespace-pre text-gray-200">{inputValue}</span>
                 {!isLoading && !isListening && (
                    <span className="inline-block w-2 h-4 bg-gray-200 animate-blink -mb-0.5 ml-0.5" />
                )}
                 {isLoading && !isChatMode && !isChatDocMode && (
                    <span className="ml-2 text-yellow-400">Processing...</span>
                )}
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    className="absolute top-0 left-0 w-full h-full bg-transparent border-none outline-none text-transparent caret-transparent"
                    autoFocus
                    disabled={isLoading || isListening}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck="false"
                />
            </div>
            {recognitionRef.current && (
                <button
                  type="button"
                  onClick={handleToggleListening}
                  disabled={isLoading}
                  title={isListening ? 'Stop listening' : 'Use voice command'}
                  aria-label={isListening ? 'Stop listening' : 'Use voice command'}
                  className={`ml-2 p-1.5 rounded-full transition-colors duration-200 ${isListening ? 'bg-red-500/80 text-white animate-pulse' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                </button>
            )}
          </div>
        </form>
        {suggestions.length > 0 && (
          <div className="text-yellow-400 flex flex-wrap gap-x-4">
            {suggestions.map(s => <span key={s}>{s}</span>)}
          </div>
        )}
      </div>
    </div>
  );
};

export default Terminal;