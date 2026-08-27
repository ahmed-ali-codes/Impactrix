
declare module 'lucide-react' {
  import { FC, SVGProps } from 'react';
  interface IconProps extends SVGProps<SVGSVGElement> {
    size?: string | number;
    color?: string;
  }
  export type Icon = FC<IconProps>;
  export const FileCode: Icon;
  export const AlertTriangle: Icon;
  export const ChevronRight: Icon;
  export const Terminal: Icon;
  export const Layers: Icon;
  export const Cpu: Icon;
  export const ShieldAlert: Icon;
  export const GitBranch: Icon;
  export const Activity: Icon;
  export const Zap: Icon;
  export const Info: Icon;
  export const Search: Icon;
}

declare module '@google/genai' {
  export interface GoogleGenAIConfig {
    apiKey: string | undefined;
  }
  export class GoogleGenAI {
    constructor(config: GoogleGenAIConfig);
    models: {
      generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
    };
  }
  export interface GenerateContentParameters {
    model: string;
    contents: any;
    config?: {
      responseMimeType?: string;
      responseSchema?: any;
      [key: string]: any;
    };
  }
  export interface GenerateContentResponse {
    readonly text: string | undefined;
    candidates?: any[];
  }
  export enum Type {
    TYPE_UNSPECIFIED = 'TYPE_UNSPECIFIED',
    STRING = 'STRING',
    NUMBER = 'NUMBER',
    INTEGER = 'INTEGER',
    BOOLEAN = 'BOOLEAN',
    ARRAY = 'ARRAY',
    OBJECT = 'OBJECT',
    NULL = 'NULL',
  }
}

declare module '@vitejs/plugin-react' {
  const react: any;
  export default react;
}
