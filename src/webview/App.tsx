import React, { useState, useEffect } from 'react';
import { ImpactAnalysis, RiskLevel } from '../extension/types';
import { ShieldAlert, Layers, Info, Zap, ChevronRight, CheckCircle2 } from 'lucide-react';

// Acquire VS Code API for sending messages back to the extension
// @ts-ignore
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : { postMessage: (msg: any) => console.log('Mock postMessage:', msg) };

const App: React.FC = () => {
  const [analysis, setAnalysis] = useState<ImpactAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'analysisResult':
          setAnalysis(message.data);
          setLoading(false);
          break;
        case 'analysisLoading':
          setLoading(true);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="w-full h-screen bg-transparent flex flex-col font-sans select-none overflow-hidden text-[var(--vscode-foreground)]">
      <div className="h-9 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-panel-background)] flex items-center px-4 justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
          <Zap size={14} className="text-yellow-500 fill-yellow-500" /> Impact Panel
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {!analysis ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4">
             <Info size={40} />
             <p className="text-xs">Type or save a file to see the blast radius of your change.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold truncate text-base">{analysis.changedSymbol}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${analysis.riskScore === RiskLevel.HIGH ? 'bg-red-900/40 text-red-400 border border-red-700' : 'bg-green-900/40 text-green-400 border border-green-700'}`}>
                  {analysis.riskScore} RISK
                </span>
              </div>
              <div className="flex gap-1">
                 {analysis.categories.map(c => <span key={c} className="text-[9px] px-1.5 py-0.5 bg-[var(--vscode-badge-background)] rounded border border-[var(--vscode-panel-border)] text-[var(--vscode-badge-foreground)]">{c}</span>)}
              </div>
            </div>

            <div className="bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] rounded p-3 space-y-2 relative overflow-hidden">
              <div className="text-[10px] font-bold text-blue-400 flex items-center gap-1">
                <ShieldAlert size={12} /> AI INSIGHT
              </div>
              <p className="text-xs leading-relaxed italic opacity-90">
                {loading ? 'Analyzing propagation...' : analysis.explanation}
              </p>
            </div>

            <div className="space-y-3">
               <div className="text-[10px] font-bold opacity-70 uppercase flex items-center gap-2">
                 <Layers size={12} /> Impacted Files ({analysis.impacts.length})
               </div>
               <div className="space-y-2">
                  {analysis.impacts.map((imp, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => vscode.postMessage({ type: 'navigateTo', filePath: imp.file, line: imp.line })}
                      className="p-3 bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] rounded shadow-sm group cursor-pointer hover:border-[var(--vscode-focusBorder)] hover:bg-[var(--vscode-list-hoverBackground)] transition-all flex flex-col gap-2"
                    >
                      <div className="text-xs flex justify-between font-medium items-center">
                        <span className="truncate font-semibold flex-1 group-hover:text-blue-400 transition-colors">{imp.file.split('/').pop()}</span>
                        <span className="opacity-60 text-[10px] ml-2 shrink-0">Line {imp.line}</span>
                      </div>
                      <div className="text-[10px] opacity-80 font-mono truncate bg-[var(--vscode-editorWidget-background)] p-1.5 rounded border border-[var(--vscode-widget-border)]">
                        {imp.context.trim()}
                      </div>
                      <div className="text-[9px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end font-medium">
                        Click to navigate <ChevronRight size={10} />
                      </div>
                    </div>
                  ))}
               </div>
            </div>

            {analysis.testSuggestions && analysis.testSuggestions.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-[var(--vscode-panel-border)]">
                <div className="text-[10px] font-bold text-green-400 uppercase flex items-center gap-1">
                  <CheckCircle2 size={12} /> Test Recommendations
                </div>
                <div className="space-y-2 mt-2">
                  {analysis.testSuggestions.map((s, i) => (
                    <div key={i} className="text-[11px] flex gap-2 items-start bg-[var(--vscode-editor-background)] p-2 rounded border border-[var(--vscode-panel-border)] shadow-sm">
                      <span className="text-green-500 font-bold mt-0.5">•</span> 
                      <span className="leading-snug opacity-90">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default App;
