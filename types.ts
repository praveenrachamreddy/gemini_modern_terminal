export enum LineType {
  COMMAND = 'COMMAND',
  OUTPUT = 'OUTPUT',
  ERROR = 'ERROR',
  SYSTEM = 'SYSTEM',
  CODE = 'CODE',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  SOURCES = 'SOURCES',
}

export interface Source {
  title: string;
  uri: string;
}

export interface Line {
  type: LineType;
  text: string | string[];
  sources?: Source[];
}
