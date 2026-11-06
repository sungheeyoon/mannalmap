import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { sourceFilesUnder } from './source-files';

/**
 * **앱이 Supabase 의 주소 · 공개 키를 읽는 자리는 `mobile/src/supabase-env.ts` 하나다** — 웹 주소의 `mobile/src/site.ts` 와 같은 꼴(ADR 0233).
 * 세션 클라이언트(`auth/client.ts`)와 공유본 클라이언트(`share/read.ts`)가 저마다 읽던 때는 한쪽만 바뀌어도 아무것도 말하지 않았다.
 */
const ROOT = join(import.meta.dirname, '..');
const READS = /EXPO_PUBLIC_SUPABASE_(?:URL|PUBLISHABLE_KEY)/;

const readersIn = (files: readonly { file: string; text: string }[]) => files.filter(({ text }) => READS.test(text)).map(({ file }) => file);

describe('앱의 Supabase 접속값', () => {
  it('EXPO_PUBLIC_SUPABASE_* 를 읽는 앱 소스는 mobile/src/supabase-env.ts 하나다', () => {
    const files = sourceFilesUnder(join(ROOT, 'mobile/src')).map((path) => ({
      file: relative(ROOT, path).split(sep).join('/'),
      text: readFileSync(path, 'utf8'),
    }));
    expect(readersIn(files)).toEqual(['mobile/src/supabase-env.ts']);
  });

  it('둘째로 읽는 자리를 잡는다', () => {
    expect(
      readersIn([
        { file: 'a.ts', text: 'const u = process.env.EXPO_PUBLIC_SUPABASE_URL;' },
        { file: 'b.ts', text: "const k = process.env['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];" },
        { file: 'c.ts', text: "import { SUPABASE_ENV } from '@/supabase-env';" },
      ]),
    ).toEqual(['a.ts', 'b.ts']);
  });
});
