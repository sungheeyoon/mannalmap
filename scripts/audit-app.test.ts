import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { auditVerdict, exceptionsOf } from './audit-app.mjs';

/**
 * **앱 의존성 감사의 이름 지정 예외**(ADR 0104 추기 2026-11-06). 예외 밖의 high 는 붉고, 감사에 더는 안 나오는 예외도 붉다 —
 * 낡은 예외가 남아 다음 advisory 를 덮지 않게. `verify.yml` 의 `audit` 이 `node scripts/audit-app.mjs` 로 이 판정을 돈다.
 */
const ROOT = join(import.meta.dirname, '..');
const advisory = (id: string, name: string, severity: string) => ({ source: 1, name, severity, url: `https://github.com/advisories/${id}` });
/** 2026-11-06 의 `mobile` 감사 모양 — 패키지 줄은 advisory 객체나 다른 패키지 이름을 `via` 로 든다 */
const report = {
  vulnerabilities: {
    zod: { severity: 'high', via: [advisory('GHSA-mrhx-c7xc-m3w5', 'zod', 'high')] },
    '@expo/cli': { severity: 'high', via: ['zod', 'glob'] },
    glob: { severity: 'moderate', via: [advisory('GHSA-3g3m-2fjr-6pw4', 'glob', 'moderate')] },
  },
};
const ZOD = { id: 'GHSA-mrhx-c7xc-m3w5' };

describe('앱 의존성 감사의 예외', () => {
  it('예외로 든 high 는 넘기고, 그 high 를 끌어온 패키지 줄(@expo/cli)도 따로 붉지 않는다', () => {
    expect(auditVerdict(report, [ZOD])).toEqual({ blocking: [], excepted: ['GHSA-mrhx-c7xc-m3w5'], stale: [] });
  });

  it('예외 밖의 high · critical 은 붉다 — moderate 이하는 막지 않는다', () => {
    expect(auditVerdict(report, []).blocking).toEqual(['GHSA-mrhx-c7xc-m3w5 zod high']);
    const fresh = { vulnerabilities: { ...report.vulnerabilities, ws: { via: [advisory('GHSA-new0-0000-0000', 'ws', 'critical')] } } };
    expect(auditVerdict(fresh, [ZOD]).blocking).toEqual(['GHSA-new0-0000-0000 ws critical']);
  });

  it('감사에 더는 안 나오는 예외는 낡은 예외로 붉다 — moderate 로 내려와도 나오기는 하니 낡지 않다', () => {
    expect(auditVerdict({ vulnerabilities: { glob: report.vulnerabilities.glob } }, [ZOD]).stale).toEqual(['GHSA-mrhx-c7xc-m3w5']);
    expect(auditVerdict({ vulnerabilities: {} }, [ZOD]).stale).toEqual(['GHSA-mrhx-c7xc-m3w5']);
    const lowered = { vulnerabilities: { zod: { via: [advisory('GHSA-mrhx-c7xc-m3w5', 'zod', 'moderate')] } } };
    expect(auditVerdict(lowered, [ZOD])).toEqual({ blocking: [], excepted: [], stale: [] });
  });

  it('예외 파일은 줄마다 GHSA id · 패키지 · 사유 · 걷을 조건 · 결정을 든다', () => {
    const list = exceptionsOf(readFileSync(join(ROOT, 'mobile', 'audit-exceptions.json'), 'utf8'));
    expect(list.map((one: { id: string }) => one.id)).toEqual(['GHSA-mrhx-c7xc-m3w5']);
    expect(() => exceptionsOf('{"exceptions":[{"id":"GHSA-x","package":"zod","reason":"","until":"u","decided":"d"}]}')).toThrow(/reason/);
    expect(() => exceptionsOf('{"exceptions":[{"id":"CVE-1","package":"zod","reason":"r","until":"u","decided":"d"}]}')).toThrow(/GHSA/);
    expect(() => exceptionsOf('{}')).toThrow(/exceptions/);
  });

  it('verify.yml 의 audit 은 뿌리 감사와 이 판정을 함께 돌고, 앱 쪽은 뿌리가 붉어도 돈다', () => {
    const yml = readFileSync(join(ROOT, '.github', 'workflows', 'verify.yml'), 'utf8');
    const job = /\n {2}audit:\n([\s\S]*?)\n {2}[a-z-]+:\n/.exec(yml)?.[1] ?? '';
    expect([...job.matchAll(/^\s+- run: (.+)$/gm)].map((one) => one[1].trim())).toEqual(['npm audit --omit=dev --audit-level=high', 'node scripts/audit-app.mjs']);
    expect(job).toContain('- run: node scripts/audit-app.mjs\n        if: ${{ !cancelled() }}');
  });
});
