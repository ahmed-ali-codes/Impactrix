
// LSP adapter implementation with PascalCase import references.
import { LanguageAdapter } from './baseAdapter';
import { SymbolInfo, UsageInfo, WorkspaceFile } from '../types';

export class LspAdapter implements LanguageAdapter {
  id = 'lsp';
  priority = 100;

  supports(filePath: string) {
    const exts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java'];
    return exts.some(ext => filePath.endsWith(ext));
  }

  extractSymbols(content: string, filePath: string): SymbolInfo[] {
    // Basic placeholder for symbol extraction via LSP
    return []; 
  }

  findUsages(symbol: SymbolInfo, workspace: WorkspaceFile[]): UsageInfo[] {
    // Basic placeholder for usage finding via LSP
    return [];
  }
}
