import * as vscode from 'vscode';
import { ImpactEngine } from './core/ImpactEngine';
import { ChangeDetector } from './core/changeDetector';
import { ImpactExplainer } from './ai/ImpactExplainer';

export function activate(context: vscode.ExtensionContext) {
  console.log("IMPAKTRIX Extension Activated");

  const engine = new ImpactEngine();
  const detector = new ChangeDetector();
  const explainer = new ImpactExplainer();

  // Decorator for gutter icon
  const impactDecorationType = vscode.window.createTextEditorDecorationType({
    // We would need a real warning.svg in media, but we can fallback to standard colors
    overviewRulerColor: 'yellow',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    backgroundColor: 'rgba(255, 255, 0, 0.2)',
    isWholeLine: false,
  });

  const provider = new ImpaktrixWebviewProvider(context.extensionUri, engine, explainer);
  
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
        const analysis = engine.analyze(filePath, line);
        if (analysis) {
          const ai = await explainer.explain(analysis);
          const fullResult = { ...analysis, ...ai };
          // Send to webview
          provider.sendAnalysis(fullResult);
        }
      });
    })
  );
}

class ImpaktrixWebviewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private engine: ImpactEngine,
    private explainer: ImpactExplainer
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
    <script>
      const vscode = acquireVsCodeApi();
      window.vscode = vscode;
    </script>
</head>
<body class="bg-transparent text-[var(--vscode-foreground)] overflow-hidden m-0 p-0">
    <div id="root"></div>
    <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

export function deactivate() {}
