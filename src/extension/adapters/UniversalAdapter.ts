
import { LanguageAdapter } from './BaseAdapter';
import { SymbolInfo, UsageInfo, WorkspaceFile } from '../types';

export class UniversalAdapter implements LanguageAdapter {
  id = 'universal';
  priority = 10;

  supports(filePath: string): boolean {
    return true;
  }

  extractSymbols(content: string, filePath: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];
    const patterns = [
      { regex: /(?:function|class|const|let|var|def|public\s+class|func)\s+([a-zA-Z0-9_$]+)/g, type: 'function' as const },
      { regex: /export\s+(?:default\s+)?(?:const|class|function)\s+([a-zA-Z0-9_$]+)/g, type: 'variable' as const },
      { regex: /@([a-zA-Z0-9_$]+)\(/g, type: 'route' as const },
    ];

    content.split('\n').forEach((line, index) => {
      patterns.forEach(({ regex, type }) => {
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(line)) !== null) {
          symbols.push({ name: match[1], type, line: index + 1, filePath });
        }
      });
    });
    return symbols;
  }

  findUsages(symbol: SymbolInfo, workspace: WorkspaceFile[]): UsageInfo[] {
    const usages: UsageInfo[] = [];
    const escapedName = symbol.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedName}\\b`, 'g');

    workspace.forEach(file => {
      file.content.split('\n').forEach((line, idx) => {
        if (file.path === symbol.filePath && (idx + 1) === symbol.line) return;
        regex.lastIndex = 0;
        if (regex.test(line)) {
          usages.push({
            symbolName: symbol.name,
            file: file.path,
            line: idx + 1,
            context: line.trim(),
            isDirect: true
          });
        }
      });
    });
    return usages;
  }
}
