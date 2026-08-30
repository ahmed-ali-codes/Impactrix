import { Project, Node, SourceFile, SyntaxKind, ts } from 'ts-morph';
import { LanguageAdapter } from './baseAdapter';
import { SymbolInfo, UsageInfo, WorkspaceFile } from '../types';
import { ImpactGraph } from '../core/ImpactGraph';
import * as path from 'path';
import * as fs from 'fs';

export class TsMorphAdapter implements LanguageAdapter {
  id = 'ts-morph';
  priority = 200;
  private project: Project;
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    const tsconfigPath = path.join(workspaceRoot, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
        this.project = new Project({ tsConfigFilePath: tsconfigPath });
    } else {
        this.project = new Project();
    }
  }

  /**
   * Register additional absolute file paths into the ts-morph project.
   * Called by ImpactEngine.refreshGraph() so that files added mid-session
   * (after construction) are picked up on the next graph population pass.
   * Idempotent — files already tracked by the project are not re-added.
   */
  addWorkspaceFiles(filePaths: string[]): void {
    for (const filePath of filePaths) {
      if (this.supports(filePath) && !this.project.getSourceFile(filePath)) {
        this.project.addSourceFileAtPathIfExists(filePath);
      }
    }
  }

  supports(filePath: string): boolean {
    return /\.(ts|tsx|js|jsx)$/.test(filePath);
  }

  extractSymbols(fileContent: string, filePath: string): SymbolInfo[] {
    let sourceFile = this.project.getSourceFile(filePath);
    if (!sourceFile) {
        sourceFile = this.project.addSourceFileAtPathIfExists(filePath);
    }
    if (sourceFile) {
        sourceFile.refreshFromFileSystemSync();
    } else {
        sourceFile = this.project.createSourceFile(filePath, fileContent, { overwrite: true });
    }

    const symbols: SymbolInfo[] = [];

    const extractFromNode = (node: Node) => {
        if (Node.isFunctionDeclaration(node) || Node.isClassDeclaration(node) || Node.isInterfaceDeclaration(node)) {
            const name = node.getName();
            if (name) {
                symbols.push({
                    name,
                    type: Node.isFunctionDeclaration(node) ? 'function' : 'class',
                    line: node.getStartLineNumber(),
                    filePath
                });
            }
        } else if (Node.isVariableStatement(node)) {
            const decls = node.getDeclarations();
            decls.forEach(d => {
                symbols.push({
                    name: d.getName(),
                    type: 'variable',
                    line: d.getStartLineNumber(),
                    filePath
                });
            });
        }
        node.forEachChild(extractFromNode);
    };

    sourceFile.forEachChild(extractFromNode);
    return symbols;
  }

  findUsages(symbol: SymbolInfo, workspace: WorkspaceFile[]): UsageInfo[] {
    const sourceFile = this.project.getSourceFile(symbol.filePath);
    if (!sourceFile) return [];

    let targetNode: Node | undefined;

    const findNode = (node: Node) => {
        if (node.getStartLineNumber() === symbol.line) {
            if (Node.isFunctionDeclaration(node) || Node.isClassDeclaration(node) || Node.isInterfaceDeclaration(node)) {
                if (node.getName() === symbol.name) targetNode = node.getNameNode();
            } else if (Node.isVariableStatement(node)) {
                const decls = node.getDeclarations();
                const d = decls.find(d => d.getName() === symbol.name);
                if (d) targetNode = d.getNameNode();
            }
        }
        if (!targetNode) node.forEachChild(findNode);
    };

    sourceFile.forEachChild(findNode);

    if (!targetNode) return [];

    const usages: UsageInfo[] = [];
    const referencedSymbols = Node.isReferenceFindable(targetNode) ? targetNode.findReferences() : [];

    for (const refSymbol of referencedSymbols) {
        for (const reference of refSymbol.getReferences()) {
            const refSourceFile = reference.getSourceFile();
            const refFilePath = refSourceFile.getFilePath();
            const isDirect = refFilePath !== symbol.filePath;

            if (!isDirect && reference.getNode().getStartLineNumber() === symbol.line) continue;

            const node = reference.getNode();
            const parentStmt = node.getFirstAncestorByKind(ts.SyntaxKind.ExpressionStatement) 
                || node.getFirstAncestorByKind(ts.SyntaxKind.VariableStatement)
                || node.getParent();
            
            usages.push({
                symbolName: symbol.name,
                file: refFilePath,
                line: node.getStartLineNumber(),
                context: parentStmt ? parentStmt.getText().split('\n')[0] : node.getText(),
                isDirect
            });
        }
    }

    return usages;
  }

  /**
   * Seed the ImpactGraph with cross-file import relationships.
   * For every source file in the ts-morph project, we follow its static
   * import declarations and register an edge: importingFile → importedFile.
   * This means getImpactedNodes(file) will return files that import `file`,
   * enabling true multi-hop transitive blast-radius computation.
   *
   * Bug 1 fix: when no tsconfig.json was found the Project starts with zero
   * source files. We discover them here (lazily, at populate time) rather
   * than at construction to avoid a synchronous startup hang. A ceiling of
   * MAX_NO_TSCONFIG_FILES guards against extremely large repos.
   */
  populateGraph(graph: ImpactGraph): void {
    // --- Bug 1 fix: discover workspace files when no tsconfig loaded any ---
    if (this.project.getSourceFiles().length === 0 && this.workspaceRoot) {
      const MAX_NO_TSCONFIG_FILES = 2000;
      try {
        const globPattern = path.join(this.workspaceRoot, '**/*.{ts,tsx,js,jsx}');
        const discovered = this.project.addSourceFilesAtPaths(globPattern);
        if (discovered.length > MAX_NO_TSCONFIG_FILES) {
          // Too many files — remove excess and warn; analysis will be partial.
          console.warn(
            `[TsMorphAdapter] No tsconfig found and workspace contains ` +
            `${discovered.length} TS/JS files — capping at ${MAX_NO_TSCONFIG_FILES} ` +
            `to prevent hang. Add a tsconfig.json for full coverage.`
          );
          discovered.slice(MAX_NO_TSCONFIG_FILES).forEach(sf => sf.forget());
        }
      } catch (e) {
        console.warn('[TsMorphAdapter] populateGraph: file discovery failed:', e);
      }
    }

    // --- Core graph population ---
    graph.clear();
    const sourceFiles = this.project.getSourceFiles();
    for (const sourceFile of sourceFiles) {
      const importingPath = sourceFile.getFilePath();
      for (const importDecl of sourceFile.getImportDeclarations()) {
        const resolved = importDecl.getModuleSpecifierSourceFile();
        if (resolved) {
          // Edge: importingPath depends on resolvedPath.
          // addDependency(from=importingPath, to=resolvedPath) means:
          // "importingPath is a caller/dependent of resolvedPath".
          graph.addDependency(importingPath, resolved.getFilePath());
        }
      }
    }
  }
}
