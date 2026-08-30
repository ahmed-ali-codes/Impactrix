
// The main logic for cross-file impact analysis.
import { UniversalAdapter } from '../adapters/UniversalAdapter';
import { LspAdapter } from '../adapters/lspAdapter';
import { ImpactGraph } from './ImpactGraph';
import { ImpactAnalysis, RiskLevel, ImpactCategory, WorkspaceFile, UsageInfo } from '../types';

import { TsMorphAdapter } from '../adapters/TsMorphAdapter';

export class ImpactEngine {
  private adapters: any[] = [];
  private graph = new ImpactGraph();
  private workspaceRoot: string;
  private workspace: WorkspaceFile[] = [];

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.adapters = [new TsMorphAdapter(workspaceRoot), new LspAdapter(), new UniversalAdapter()];
    this.adapters.sort((a, b) => b.priority - a.priority);
    // Seed the transitive dependency graph from every adapter that can provide
    // import-level dependency data (currently TsMorphAdapter).
    for (const adapter of this.adapters) {
      if (typeof adapter.populateGraph === 'function') {
        adapter.populateGraph(this.graph);
      }
    }
  }

  // We no longer manually update workspace with string arrays for the AST parser,
  // but we keep this signature in case UniversalAdapter still needs it for non-TS files.
  updateWorkspace(workspace: WorkspaceFile[]) {
    this.workspace = workspace;
    // We rely on AST parser for graph building now for TS/JS files.
  }

  analyze(filePath: string, line: number): ImpactAnalysis | null {
    let content = '';
    const file = this.workspace?.find(f => f.path === filePath);
    
    if (file) {
      content = file.content;
    } else {
      try {
        content = require('fs').readFileSync(filePath, 'utf-8');
      } catch (e) {
        return null;
      }
    }

    const adapter = this.adapters.find(a => a.supports(filePath));
    if (!adapter) return null;

    const symbols = adapter.extractSymbols(content, filePath);
    if (symbols.length === 0) return null;

    const symbol = symbols.find(s => s.line === line) || symbols.reduce((prev: any, curr: any) => 
      Math.abs(curr.line - line) < Math.abs(prev.line - line) ? curr : prev, symbols[0]);

    if (!symbol) return null;

    const direct = adapter.findUsages(symbol, this.workspace || []);
    
    // We get indirect files purely from the adapter if it's TsMorph, otherwise fallback to mock graph
    const indirectFiles = this.graph.getImpactedNodes(filePath, 2);
    const indirect: UsageInfo[] = indirectFiles
      .filter(f => !direct.some((d: any) => d.file === f))
      .map(f => ({ 
        symbolName: 'Module', 
        file: f, 
        line: 1, 
        context: `Indirect impact via dependency on ${filePath}`, 
        isDirect: false 
      }));

    const impacts = [...direct, ...indirect];
    return {
      changedSymbol: symbol.name,
      file: filePath,
      fileContent: content,
      impacts,
      categories: this.categorize(impacts),
      riskScore: impacts.length > 5 ? RiskLevel.HIGH : (impacts.length > 2 ? RiskLevel.MEDIUM : RiskLevel.LOW)
    };
  }

  private categorize(impacts: UsageInfo[]): ImpactCategory[] {
    const cats = new Set<ImpactCategory>();
    impacts.forEach(i => {
      if (i.file.match(/\.(tsx|jsx|html|css)$/)) cats.add(ImpactCategory.UI);
      else if (i.file.includes('api') || i.file.includes('routes')) cats.add(ImpactCategory.API);
      else cats.add(ImpactCategory.LOGIC);
    });
    return Array.from(cats);
  }
}
