import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REMINDER, responseOf } from './compact-hint.mjs';

describe('compact-hint — 압축 뒤에 한 줄을 일러 준다 (docs/agents/delegation/permissions.md)', () => {
  it('한 줄이 역할 문서 다시 읽기 · 지금 재기 · 쉬운 한국어를 든다', () => {
    expect(REMINDER).toContain('docs/start.md');
    expect(REMINDER).toContain('node scripts/session-status.mjs');
    expect(REMINDER).toContain('쉬운 한국어');
  });

  it('SessionStart 의 additionalContext 로만 건넨다 — 권한 결정은 없다', () => {
    expect(responseOf()).toEqual({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: REMINDER } });
  });

  it('스크립트로 부르면 그 JSON 한 줄을 찍는다', () => {
    const out = execFileSync('node', [join(__dirname, 'compact-hint.mjs')], { input: '{"source":"compact"}', encoding: 'utf8' });
    expect(JSON.parse(out)).toEqual(responseOf());
  });

  it('settings.json 의 SessionStart 훅이 압축(compact)에만 이 스크립트를 건다', () => {
    const settings = JSON.parse(readFileSync(join(__dirname, '../.claude/settings.json'), 'utf8'));
    const entries: { matcher?: string; hooks: { command: string }[] }[] = settings.hooks?.SessionStart ?? [];
    const ours = entries.filter((entry) => entry.hooks.some((hook) => hook.command.includes('scripts/compact-hint.mjs')));
    expect(ours).toHaveLength(1);
    expect(ours[0].matcher).toBe('compact');
  });
});
