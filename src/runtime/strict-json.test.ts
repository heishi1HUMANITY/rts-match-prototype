import { describe, expect, it } from 'vitest';
import { parseStrictJson } from './strict-json';

describe('strict JSON import', () => {
  it('rejects duplicate and escaped-equivalent keys in the same object', () => {
    expect(() => parseStrictJson('{"rules":{"node":1,"node":2}}')).toThrow(
      'master.rules.node',
    );
    expect(() => parseStrictJson('{"node":1,"\\u006eode":2}')).toThrow('重複');
  });
  it('permits identical keys in different objects and punctuation in strings', () => {
    const text =
      '{"a":[{"key":"\\\\\\\"},"},{"key":null}],"key":false,"n":-1.5e2}';
    expect(parseStrictJson(text)).toEqual(JSON.parse(text));
  });
  it('keeps JSON syntax validation and limits deeply nested input', () => {
    expect(() => parseStrictJson('{"x":}')).toThrow();
    expect(() =>
      parseStrictJson('['.repeat(258) + '0' + ']'.repeat(258)),
    ).toThrow('深すぎ');
  });
});
