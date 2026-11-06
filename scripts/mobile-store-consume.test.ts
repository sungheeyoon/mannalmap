import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { sourceFilesUnder } from './source-files';

/**
 * **앱은 Google Play 구매를 소비하지 않는다**(ADR 0230). 서버가 Google 에서 확인 · 한 번 지급한 뒤 `purchases.products.consume` 을 부른다 —
 * 앱이 먼저 소비하면(`finishTransaction` · `consumePurchaseAndroid`) 지급이 실패한 구매를 되돌릴 길이 없고, 소비되지 않은 구매를 다시 보내는
 * 복구(`resendUnfinishedPurchases`)도 설 자리를 잃는다.
 *
 * 주석은 안 센다 — 「부르지 않는다」고 적는 자리는 남아야 한다. 이름이 코드의 낱말(식별자 · 문자열)로 서면 부르는 것으로 센다:
 * 구조 분해(`{ finishTransaction }`) · 속성(`iap.finishTransaction`) · 글자로 여는 것(`module['finishTransaction']`)이 다 같다.
 */
const ROOT = join(import.meta.dirname, '..');
const FORBIDDEN = /^(?:finishTransaction|consumePurchase\w*)$/;

/** 주석을 뺀 코드의 낱말 가운데 소비 이름 */
const consumeCallsIn = (source: string, file = 'x.tsx'): string[] => {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard, source);
  const found: string[] = [];
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const text =
      token === ts.SyntaxKind.Identifier
        ? scanner.getTokenText()
        : token === ts.SyntaxKind.StringLiteral || token === ts.SyntaxKind.NoSubstitutionTemplateLiteral
          ? scanner.getTokenValue()
          : null;
    if (text !== null && FORBIDDEN.test(text)) found.push(text);
  }
  return found;
};

describe('앱은 Google Play 구매를 소비하지 않는다 (ADR 0230)', () => {
  it('mobile/src 의 코드가 finishTransaction · consumePurchase* 를 부르지 않는다', () => {
    const callers = sourceFilesUnder(join(ROOT, 'mobile', 'src'))
      .flatMap((file) => consumeCallsIn(readFileSync(file, 'utf8'), file).map((name) => `${relative(ROOT, file).split('\\').join('/')} — ${name}`));
    expect(callers).toEqual([]);
  });

  it('부르는 꼴은 다 잡고, 주석 · 비슷한 다른 이름은 안 잡는다', () => {
    expect(consumeCallsIn("const { finishTransaction } = await import('expo-iap');")).toEqual(['finishTransaction']);
    expect(consumeCallsIn('await (await iap()).finishTransaction({ purchase, isConsumable: true });')).toEqual(['finishTransaction']);
    expect(consumeCallsIn("await module['consumePurchaseAndroid'](token);")).toEqual(['consumePurchaseAndroid']);
    expect(consumeCallsIn('import { consumePurchase as eat } from "expo-iap";')).toEqual(['consumePurchase']);
    expect(consumeCallsIn('/** `finishTransaction` 을 부르지 않는다 */\n// consumePurchaseAndroid 도\nconst ok = 1;')).toEqual([]);
    expect(consumeCallsIn('const finishTransactionNote = 1; const resendUnfinishedPurchases = 2;')).toEqual([]);
  });
});
