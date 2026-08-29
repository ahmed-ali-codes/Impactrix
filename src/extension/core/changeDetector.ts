
// Simple utility to track delta between file saves.
export class ChangeDetector {
  private lastContents: Map<string, string> = new Map();

  onDidSave(filePath: string, content: string, callback: (line: number) => void) {
    const last = this.lastContents.get(filePath);
    if (!last) {
      // First edit, assume line 1 or wait for next edit. Actually, let's just save it.
      this.lastContents.set(filePath, content);
      return;
    }
    if (last !== content) {
      const lines = content.split('\n');
      const lastLines = last.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i] !== lastLines[i]) {
          callback(i + 1);
          break;
        }
      }
    }
    this.lastContents.set(filePath, content);
  }
}
