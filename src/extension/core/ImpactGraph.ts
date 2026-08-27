
// Graph data structure to track impact propagation across files.
export class ImpactGraph {
  private nodes: Set<string> = new Set();
  private edges: Map<string, Set<string>> = new Map();

  addDependency(from: string, to: string) {
    this.nodes.add(from);
    this.nodes.add(to);
    if (!this.edges.has(to)) this.edges.set(to, new Set());
    this.edges.get(to)!.add(from);
  }

  getImpactedNodes(nodeId: string, depth = 2, visited = new Set<string>()): string[] {
    if (depth <= 0 || visited.has(nodeId)) return [];
    visited.add(nodeId);
    
    const callers = Array.from(this.edges.get(nodeId) || []);
    let result = [...callers];
    
    callers.forEach(caller => {
      result = [...result, ...this.getImpactedNodes(caller, depth - 1, visited)];
    });
    
    return Array.from(new Set(result));
  }

  clear() {
    this.nodes.clear();
    this.edges.clear();
  }
}
