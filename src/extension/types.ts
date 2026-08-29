
export enum ImpactCategory {
  UI = 'UI',
  LOGIC = 'Logic',
  API = 'API',
  CONFIG = 'Config',
  DATABASE = 'Database'
}

export enum RiskLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High'
}

export interface SymbolInfo {
  name: string;
  type: 'function' | 'class' | 'variable' | 'component' | 'route' | 'config';
  line: number;
  filePath: string;
}

export interface UsageInfo {
  symbolName: string;
  file: string;
  line: number;
  context: string;
  isDirect: boolean;
}

export interface ImpactAnalysis {
  changedSymbol: string;
  file: string;
  fileContent?: string;
  impacts: UsageInfo[];
  categories: ImpactCategory[];
  riskScore: RiskLevel;
  explanation?: string;
  testSuggestions?: string[];
}

export interface WorkspaceFile {
  path: string;
  content: string;
  language: string;
}
