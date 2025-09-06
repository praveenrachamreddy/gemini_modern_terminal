import type { Line } from './types';
import { LineType } from './types';

export const PROMPT_SYMBOL = '➜';
export const USERNAME = 'praveen';
export const HOSTNAME = 'gemini-os';

export const COMMANDS: string[] = [
  'help',
  'ask',
  'chat',
  'search',
  'code',
  'image',
  'editimg',
  'video',
  'upload',
  'docs',
  'chatdoc',
  'neofetch',
  'date',
  'whoami',
  'about',
  'clear',
];

const PRAVEEN_ASCII = `
██████╗░░██████╗░░█████╗░██╗░░░██╗███████╗███████╗███╗░░██╗
██╔══██╗██╔══██╗██╔══██╗██║░░░██║██╔════╝██╔════╝████╗░██║
██████╔╝██████╔╝███████║╚██╗░██╔╝█████╗░░█████╗░░██╔██╗██║
██╔═══╝░██╔══██╗██╔══██║░╚████╔╝░██╔══╝░░██╔══╝░░██║╚████║
██║░░░░░██║░░██║██║░░██║░░╚██╔╝░░███████╗███████╗██║░╚███║
╚═╝░░░░░╚═╝░░╚═╝╚═╝░░╚═╝░░░╚═╝░░░╚══════╝╚══════╝╚═╝░░╚══╝
`;

const asciiWelcome: Line[] = PRAVEEN_ASCII
  .trim()
  .split('\n')
  .map(text => ({ type: LineType.SYSTEM, text }));

export const WELCOME_LINES: Line[] = [
    ...asciiWelcome,
    { type: LineType.SYSTEM, text: ' ' },
    { type: LineType.SYSTEM, text: 'Welcome to Gemini Terminal!' },
    { type: LineType.SYSTEM, text: ' '},
    { type: LineType.SYSTEM, text: 'Try typing a command and press Tab for autocompletion.'},
    { type: LineType.SYSTEM, text: 'Type `help` to see a list of available commands.' },
    { type: LineType.SYSTEM, text: 'Type `ask <your question>` to talk to the AI for a single response.' },
    { type: LineType.SYSTEM, text: 'Type `chat` to start a persistent conversation with the AI.' },
    { type: LineType.SYSTEM, text: 'Type `search <your question>` to get answers on recent events from Google.'},
    { type: LineType.SYSTEM, text: 'Type `code <your coding question>` to get help from the AI Code Assistant.' },
    { type: LineType.SYSTEM, text: 'Type `image <your prompt>` to generate an image with AI.' },
    { type: LineType.SYSTEM, text: 'Type `editimg <your edit instruction>` to modify the last image.' },
    { type: LineType.SYSTEM, text: 'Type `video <your prompt>` to generate a video with AI.' },
    { type: LineType.SYSTEM, text: "Type `upload` to select documents, `docs` to manage them, and `chatdoc` to chat." },
    { type: LineType.SYSTEM, text: '--------------------------------------------------' },
];

export const HELP_TEXT: string[] = [
  'Available Commands:',
  ...COMMANDS.map(cmd => `  ${cmd.padEnd(12, ' ')} - ${getCommandDescription(cmd)}`),
];

function getCommandDescription(command: string): string {
    switch (command) {
        case 'help': return 'Shows this help message.';
        case 'ask': return 'Ask the Gemini AI a single question.';
        case 'chat': return 'Enter a persistent chat session with the AI.';
        case 'search': return 'Ask AI with Google Search for up-to-date info.';
        case 'code': return 'Ask the AI Code Assistant a question.';
        case 'image': return 'Generate an image using AI.';
        case 'editimg': return 'Edit the last generated image with a new prompt.';
        case 'video': return 'Generate a video using AI. (This may take a few minutes)';
        case 'upload': return 'Upload a text document (.txt, .md, etc.) to chat with.';
        case 'docs': return 'Manage documents (use: docs <list|select|clear>).';
        case 'chatdoc': return 'Enter a persistent chat session about the active document.';
        case 'neofetch': return 'Display system information.';
        case 'date': return 'Display the current date and time.';
        case 'whoami': return 'Display the current user.';
        case 'about': return 'Information about this terminal.';
        case 'clear': return 'Clears the terminal screen.';
        default: return '';
    }
}


export const ABOUT_TEXT: string[] = [
    'Gemini Modern Terminal v1.0.0',
    'A React and Tailwind CSS project.',
    'Powered by the Google Gemini API.',
];

export const NEOFETCH_ASCII = `
        ..,,;;;::;,..
   ..,;''             ''';,..
 .,'                      ',.
,'                           ',
/    ,gP"""""""""Ybg,           \\
|   i' ,d'"Y'  'Y'"b, 'i          |
|   d' d'  '  '  'b 'b          |
|   8  8   '  '   8  8          |
|   I, Y,        ,P ,I          |
|   'b, 'b,,,,,,d' ,d'          |
|    'Y, ''YPPY'' ,P'           |
\\     'b,      ,d'            /
 ',      'YMMMMY'       ,'
  '.                   .'
    ''';,         ,;'''
        ''';;;;'''
`;