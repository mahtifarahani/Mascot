import { describe, expect, it } from 'vitest';
import { editorForApp } from '../src/core/editor';
import { Request } from '../src/protocol';

describe('editor launch target', () => {
  it('uses the host application identity', () => {
    expect(editorForApp('Cursor')).toBe('cursor');
    expect(editorForApp('Visual Studio Code')).toBe('vscode');
  });
  it('does not launch stable VS Code for an unknown editor or a different distribution', () => {
    expect(() => editorForApp('VSCodium')).toThrow('not supported');
    expect(() => editorForApp('Visual Studio Code - Insiders')).toThrow('not supported');
  });
  it('rejects editor selection from webview messages', () => {
    expect(Request.safeParse({ type: 'editor', editor: 'vscode' }).success).toBe(false);
  });
});
