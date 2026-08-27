
// The main logic for cross-file impact analysis.
import { UniversalAdapter } from '../adapters/UniversalAdapter';
import { LspAdapter } from '../adapters/lspAdapter';
import { ImpactGraph } from './ImpactGraph';
import { ImpactAnalysis, RiskLevel, ImpactCategory, WorkspaceFile, UsageInfo } from '../types';

export class ImpactEngine {
  private adapters = [new LspAdapter(), new UniversalAdapter()];
  private graph = new ImpactGraph();
  private workspace: WorkspaceFile[] = [];

  constructor() {
    this.adapters.sort((a, b) => b.priority - a.priority);
  }

  updateWorkspace(workspace: WorkspaceFile[]) {
    this.workspace = workspace;
    this.graph.clear();
    workspace.forEach(file => {
      workspace.forEach(other => {
        if (other.path === file.path) return;
        const fileName = other.path.split('/').pop()?.split('.')[0];
        if (fileName && file.content.includes(fileName)) {
          this.graph.addDependency(file.path, other.path);
        }
      });
    });
  }

  analyze(filePath: string, line: number): ImpactAnalysis | null {
    const file = this.workspace.find(f => f.path === filePath);
    if (!file) return null;

    const adapter = this.adapters.find(a => a.supports(filePath));
    if (!adapter) return null;

    const symbols = adapter.extractSymbols(file.content, filePath);
    if (symbols.length === 0) return null;

    const symbol = symbols.find(s => s.line === line) || symbols.reduce((prev, curr) => 
      Math.abs(curr.line - line) < Math.abs(prev.line - line) ? curr : prev, symbols[0]);

    if (!symbol) return null;

    const direct = adapter.findUsages(symbol, this.workspace);
    const indirectFiles = this.graph.getImpactedNodes(filePath, 2);
    const indirect: UsageInfo[] = indirectFiles
      .filter(f => !direct.some(d => d.file === f))
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
