import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { missingSkills, parseSkillTable, ROOT, TABLE_DOC } from './skills-check.mjs';

const SCRIPT = join(ROOT, 'scripts', 'skills-check.mjs');
const homes: string[] = [];

/** `.claude/skills/<이름>/SKILL.md` 를 든 가짜 홈 */
function fakeHome(installed: string[]) {
  const home = mkdtempSync(join(tmpdir(), 'skills-check-'));
  homes.push(home);
  for (const name of installed) {
    mkdirSync(join(home, '.claude', 'skills', name), { recursive: true });
    writeFileSync(join(home, '.claude', 'skills', name, 'SKILL.md'), `---\nname: ${name}\n---\n`);
  }
  return home;
}

const run = (home: string) => spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env: { ...process.env, HOME: home } });

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

type Row = { name: string; source: string; install: string };
const rows: Row[] = parseSkillTable(readFileSync(join(ROOT, TABLE_DOC), 'utf8'));

describe('skills:check — 문서가 부르는 전역 스킬이 홈에 있는지 견준다', () => {
  it('표는 「전역 스킬」 절에서 읽히고 `/retro` 가 있다', () => {
    expect(rows.map((row) => row.name)).toContain('retro');
    for (const row of rows) expect(row.install).not.toBe('');
  });

  it('홈에 다 있으면 없다고 찍지 않는다', () => {
    const result = run(fakeHome(rows.map((row) => row.name)));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`전역 스킬 ${rows.length}개가 다 있다`);
  });

  it('없는 것은 이름과 까는 명령을 찍고, 깔지 않는다', () => {
    const home = fakeHome(rows.filter((row) => row.name !== 'retro').map((row) => row.name));
    const result = run(home);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('1개가 없다');
    expect(result.stdout).toContain('retro  ←  npx skills add mattpocock/skills@retro -g -y');
    expect(missingSkills(rows, home).map((row: Row) => row.name)).toEqual(['retro']);
  });

  it('SKILL.md 가 없는 빈 폴더는 없는 것으로 센다', () => {
    const home = fakeHome([]);
    mkdirSync(join(home, '.claude', 'skills', 'retro'), { recursive: true });
    expect(missingSkills(rows, home)).toHaveLength(rows.length);
  });

  it('절이나 줄이 없으면 빈 목록으로 지나가지 않고 던진다', () => {
    expect(() => parseSkillTable('# 다른 문서\n')).toThrow('전역 스킬');
    expect(() => parseSkillTable('# x\n\n## 전역 스킬 — 비었다\n\n글만 있다\n')).toThrow('스킬 줄이 없다');
  });
});
