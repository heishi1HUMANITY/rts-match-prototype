/** JSON.parse accepts duplicate object keys. Imports must reject silent overwrites. */
export function parseStrictJson(text: string): unknown {
  const parsed: unknown = JSON.parse(text);
  let offset = 0;
  const whitespace = (): void => {
    while (/\s/.test(text[offset] ?? '') && offset < text.length) offset += 1;
  };
  const string = (): string => {
    const start = offset++;
    while (offset < text.length) {
      const char = text[offset++];
      if (char === '\\') offset += 1;
      else if (char === '"') break;
    }
    return JSON.parse(text.slice(start, offset)) as string;
  };
  const value = (path: string, depth: number): void => {
    if (depth > 256) throw new Error('JSONの階層が深すぎます');
    whitespace();
    const char = text[offset];
    if (char === '{') {
      offset += 1;
      whitespace();
      const keys = new Set<string>();
      if (text[offset] !== '}') {
        for (;;) {
          whitespace();
          const key = string();
          if (keys.has(key))
            throw new Error(`重複したJSONキー: ${path}.${key}`);
          keys.add(key);
          whitespace();
          offset += 1; // colon (syntax already checked by JSON.parse)
          value(`${path}.${key}`, depth + 1);
          whitespace();
          if (text[offset] !== ',') break;
          offset += 1;
        }
      }
      offset += 1;
    } else if (char === '[') {
      offset += 1;
      whitespace();
      let index = 0;
      if (text[offset] !== ']') {
        for (;;) {
          value(`${path}[${index++}]`, depth + 1);
          whitespace();
          if (text[offset] !== ',') break;
          offset += 1;
        }
      }
      offset += 1;
    } else if (char === '"') string();
    else {
      while (offset < text.length && !/[\s,\]}]/.test(text[offset]!))
        offset += 1;
    }
  };
  value('master', 0);
  return parsed;
}
