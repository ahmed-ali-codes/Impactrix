import * as vscode from 'vscode';
import { ImpactEngine } from './core/ImpactEngine';
import { ChangeDetector } from './core/changeDetector';
import { ImpactExplainer } from './ai/ImpactExplainer';

export function activate(context: vscode.ExtensionContext) {
  try {
    vscode.window.showInformationMessage("IMPAKTRIX is waking up...");
    console.log("IMPAKTRIX Extension Activated");

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    let engine: ImpactEngine | null = null;
    const detector = new ChangeDetector();
    const explainer = new ImpactExplainer(context.extensionPath);
    
    // Create Diagnostic Collection for squiggly lines
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('impaktrix');
    context.subscriptions.push(diagnosticCollection);

  // Decorator for gutter icon
  const impactDecorationType = vscode.window.createTextEditorDecorationType({
    // We would need a real warning.svg in media, but we can fallback to standard colors
    overviewRulerColor: 'yellow',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    backgroundColor: 'rgba(255, 255, 0, 0.2)',
    isWholeLine: false,
  });

    const provider = new ImpaktrixWebviewProvider(context.extensionUri, explainer, () => {
      if (!engine) engine = new ImpactEngine(workspaceRoot);
      return engine;
    });
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'impaktrix-impact-panel',
      provider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('impaktrix.analyze', () => {
      vscode.window.showInformationMessage('Impaktrix Analysis triggered.');
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (e) => {
      // In a real scenario, use debouncing here.
      // We use our naive change detector to find the changed line.
      const filePath = e.document.uri.fsPath;
      const content = e.document.getText();
      
      detector.onDidSave(filePath, content, async (line) => {
        // Highlight in editor
        const editor = vscode.window.visibleTextEditors.find(ed => ed.document.uri.fsPath === filePath);
        if (editor) {
          const range = new vscode.Range(line - 1, 0, line - 1, 0);
          editor.setDecorations(impactDecorationType, [range]);
        }

        // Analyze and explain
        if (!engine) engine = new ImpactEngine(workspaceRoot);
        const analysis = engine.analyze(filePath, line);

        if (analysis) {
          const ai = await explainer.explain(analysis);
          analysis.explanation = ai.explanation;
          analysis.testSuggestions = ai.testSuggestions;
          
          provider.sendAnalysis(analysis);
          
          // Show squiggly line and hover diagnostic
          if (editor) {
            const range = new vscode.Range(line - 1, 0, line - 1, 100);
            const diagnostic = new vscode.Diagnostic(
              range,
              `IMPAKTRIX: Changed symbol '${analysis.changedSymbol}'. ${analysis.impacts.length} usages affected. Risk: ${analysis.riskScore}\n\nClick to view full impact in sidebar.`,
              vscode.DiagnosticSeverity.Warning
            );
            diagnosticCollection.set(editor.document.uri, [diagnostic]);
          }
        } else {
           if (editor) diagnosticCollection.set(editor.document.uri, []);
        }
      });
    })
  );

  // Add a Hover provider to make the diagnostic more prominent
  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ scheme: 'file' }, {
      provideHover(document, position, token) {
        const diagnostics = diagnosticCollection.get(document.uri);
        if (diagnostics) {
          const diag = diagnostics.find(d => d.range.contains(position));
          if (diag) {
            const markdown = new vscode.MarkdownString();
            markdown.appendMarkdown(`**⚡ IMPAKTRIX Impact Detected**\n\n`);
            markdown.appendMarkdown(`${diag.message}\n\n`);
            markdown.appendMarkdown(`*[Open Impact Panel](command:impaktrix.analyze) for details.*`);
            markdown.isTrusted = true;
            return new vscode.Hover(markdown);
          }
        }
        return null;
      }
    })
  );
  } catch (err: any) {
    vscode.window.showErrorMessage("IMPAKTRIX Activation Error: " + (err.message || String(err)));
  }
}

class ImpaktrixWebviewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private explainer: ImpactExplainer,
    private getEngine: () => ImpactEngine
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    
    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.type === 'navigateTo') {
        const filePath = message.filePath;
        const line = message.line;
        vscode.workspace.openTextDocument(filePath).then(doc => {
          vscode.window.showTextDocument(doc).then(editor => {
             const range = new vscode.Range(line - 1, 0, line - 1, 0);
             editor.selection = new vscode.Selection(range.start, range.end);
             editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
          });
        });
      }
    });

    webviewView.webview.onDidReceiveMessage(data => {
      switch (data.type) {
        case 'analyze': {
          vscode.window.showInformationMessage(`Requested analysis for line ${data.line}`);
          break;
        }
      }
    });
  }

  public sendAnalysis(data: any) {
    if (this._view) {
      this._view.webview.postMessage({ type: 'analysisResult', data });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Path to the Vite build output
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'bundle.js'));
    let styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'bundle.css'));

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IMPAKTRIX Panel</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Fira+Code&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="${styleUri}">
</head>
<body class="bg-transparent text-[var(--vscode-foreground)] overflow-hidden m-0 p-0">
    <div id="root"></div>
    <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

export function deactivate() {}
