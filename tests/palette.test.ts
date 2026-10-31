import { describe, expect, it } from 'vitest';
import { accountHue, hslToHex } from '../src/palette';

describe('account palette', () => {
  it('keeps one stable hue per account id', () => {
    const id = '11111111-2222-4333-8444-555555555555';
    expect(accountHue(id)).toBe(accountHue(id));
  });
  it('converts HSL to hex', () => {
    expect(hslToHex(0, 1, .5)).toBe('#ff0000');
    expect(hslToHex(120, 1, .5)).toBe('#00ff00');
    expect(hslToHex(240, 1, .5)).toBe('#0000ff');
  });
});
