import * as vscode from 'vscode';
import { SidebarProvider } from './panel/SidebarProvider';

export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new SidebarProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'markdownSuji.sidebar',
      sidebarProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('markdownSuji.query', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('请先打开一个 Markdown 文件');
        return;
      }
      const selection = editor.document.getText(editor.selection);
      if (!selection) {
        vscode.window.showInformationMessage('请先选中要查询的关键词');
        return;
      }

      await vscode.commands.executeCommand('markdownSuji.sidebar.focus');
      sidebarProvider.query(selection);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('markdownSuji.insertText', (text: string) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      editor.edit((editBuilder) => {
        editBuilder.insert(editor.selection.active, `\n${text}\n`);
      });
    })
  );
}

export function deactivate() {}
