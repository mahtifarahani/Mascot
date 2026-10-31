import type { Editor } from '../protocol';

/** Do not redirect an unknown editor to a different installed application. */
export function editorForApp(appName: string): Editor {
  switch (appName.trim().toLowerCase()) {
    case 'cursor': return 'cursor';
    case 'visual studio code': return 'vscode';
    default: throw new Error('Mascot supports Cursor and Visual Studio Code. This editor is not supported; no environment was prepared or launched.');
  }
}
