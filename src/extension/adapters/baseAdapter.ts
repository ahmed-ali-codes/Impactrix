
// Base adapter interface for language-specific analysis.
import { SymbolInfo, UsageInfo, WorkspaceFile } from '../types';

export interface LanguageAdapter {
  id: string;
  priority: number;
  supports(filePath: string): boolean;
  extractSymbols(fileContent: string, filePath: string): SymbolInfo[];
  findUsages(symbol: SymbolInfo, workspace: WorkspaceFile[]): UsageInfo[];
}
