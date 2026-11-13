import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { asPosix, filesUnder } from './ui/source-files';

/**
 * **화면 안 실패 줄은 `FailureLine` 하나다**(`app/ui/failure-line.tsx`, ADR 0164 「덧」).
 *
 * `role="alert"` 를 손으로 적은 자리는 아래 목록뿐이다 — 까닭이 있어 부품 밖에 남은 것. 목록 밖에서 새로 적거나 적힌 수를 넘으면 붉다. 부품 밖의 붉은 글씨는 `FAILURE_TEXT` 를 든다.
 */

const KEPT: Readonly<Record<string, { count: number; why: string }>> = {
  'app/error-screen.tsx': { count: 1, why: '화면 전체의 오류 경계 — 화면 안의 줄이 아니다' },
  /* 주 단추 바로 아래의 폼 오류 한 줄 — 첫 화면 · 궁합 · 사람 추가 · 출생 정보 수정 · 풀이 의견 · 가입이 이 부품 하나를 쓴다(운영자 2026-11-14) */
  'app/ui/form-error.tsx': { count: 1, why: '폼 오류 한 줄 — 단추가 aria-describedby 로 가리킨다' },
  'app/saju-calculator.tsx': {
    count: 1,
    why: '계산이 거절한 입력을 결과 자리에 세우는 카드(고칠 입력을 말한다)',
  },
  'app/me/compat/screen.tsx': { count: 1, why: '같은 사람을 둘 고른 것을 결과 자리에 세우는 카드 — 고를 것을 말한다' },
  'app/signup/form.tsx': { count: 2, why: '칸 곁의 거절 · 검증 문장 — 칸이 aria-describedby 로 가리킨다' },
  /* 옮길 자리인데 다른 작업이 맡았다 — 줄어들기만 한다 */
  'app/me/chat/composer.tsx': { count: 1, why: '채팅 작업이 맡은 파일 — 옮길 자리(ADR 0164 「덧」)' },
};

const tsxFiles = (dir: string): string[] =>
  filesUnder(dir).filter((path) => path.endsWith('.tsx') && !path.endsWith('.test.tsx'));

function alertsByFile(): Record<string, number> {
  const found: Record<string, number> = {};
  for (const path of tsxFiles('app')) {
    const file = asPosix(path);
    if (file === 'app/ui/failure-line.tsx') continue;
    const count = (readFileSync(path, 'utf8').match(/role="alert"/g) ?? []).length;
    if (count > 0) found[file] = count;
  }
  return found;
}

describe('화면 안 실패 줄', () => {
  it('부품 밖의 role="alert" 는 까닭이 적힌 자리뿐이다', () => {
    const found = alertsByFile();
    const stray = Object.keys(found).filter((file) => !(file in KEPT));
    expect(stray).toEqual([]);
  });

  it('남긴 자리는 적힌 수를 넘지 않는다 — 줄어들기만 한다', () => {
    const found = alertsByFile();
    const over = Object.entries(KEPT).filter(([file, { count }]) => (found[file] ?? 0) > count);
    expect(over.map(([file]) => file)).toEqual([]);
  });
});
