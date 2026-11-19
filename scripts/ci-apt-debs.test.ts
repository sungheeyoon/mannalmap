/**
 * CI 의 apt 꾸러미 캐시(`scripts/ci-apt-debs.sh`)가 **apt 목록의 SHA256 과 맞는 .deb 만 넣고, 지금 깔린 판만 거두는가** (G-169 항목 4).
 *
 * apt 는 받는 자리에 이름과 크기가 맞는 파일이 있으면 해시를 안 본다 — 그래서 같은 크기로 깨진 파일이 캐시에 들면 다음 실행마다 되살아나
 * dpkg 가 실패한다. 넣기의 대조가 그 자리를 막는다. `dpkg-deb` · `apt-cache` · `dpkg-query` 는 가짜로 바꿔 PATH 앞에 둔다 — 가짜 `dpkg-deb` 는
 * 파일 이름(`<꾸러미>_<판>.deb`)에서 칸을 읽고, `apt-cache show <꾸러미>=<판>` 은 `records` 파일의 그 줄을, `dpkg-query` 는 `installed`
 * 파일의 판을 답한다.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const SCRIPT = resolve(__dirname, 'ci-apt-debs.sh');

const FAKES: Record<string, string[]> = {
  'dpkg-deb': [
    'base="$(basename "$2" .deb)"',
    'case "$3" in Package) echo "${base%%_*}" ;; Version) echo "${base#*_}" ;; esac',
  ],
  'apt-cache': ['grep "^$2 " "$FAKE_DIR/records" | while read -r _ hash; do printf \'Package: x\\nSHA256: %s\\n\\n\' "$hash"; done'],
  'dpkg-query': [
    'name="${*: -1}"',
    'version="$(grep "^$name " "$FAKE_DIR/installed" | cut -d" " -f2)"',
    '[ -n "$version" ] || exit 1',
    'printf "install ok installed %s" "$version"',
  ],
};

const sha = (body: string) => createHash('sha256').update(body).digest('hex');

function world() {
  const root = mkdtempSync(join(tmpdir(), 'ci-apt-debs-'));
  const bin = join(root, 'bin');
  const cache = join(root, 'cache');
  const archives = join(root, 'archives');
  for (const dir of [bin, cache, archives]) mkdirSync(dir);
  for (const [name, body] of Object.entries(FAKES)) {
    writeFileSync(join(bin, name), ['#!/usr/bin/env bash', ...body].join('\n') + '\n');
    chmodSync(join(bin, name), 0o755);
  }
  const run = (mode: 'restore' | 'collect') =>
    spawnSync('bash', [SCRIPT, mode, cache], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_DIR: root, APT_ARCHIVES: archives, SUDO: '' },
    });
  return { root, cache, archives, run };
}

describe('ci-apt-debs.sh', () => {
  it('restore — apt 목록의 SHA256 과 맞는 것만 넣고, 같은 크기로 깨진 것 · 목록에 없는 것은 버린다', () => {
    const w = world();
    writeFileSync(join(w.cache, 'fonts-a_1.0.deb'), 'good');
    writeFileSync(join(w.cache, 'fonts-b_2.0.deb'), 'bad!'); // 크기는 같고 몸은 다르다
    writeFileSync(join(w.cache, 'fonts-c_3.0.deb'), 'gone');
    // fonts-a 는 변종 기록이 둘이다 — 그 가운데 하나와 맞으면 된다
    writeFileSync(join(w.root, 'records'), [`fonts-a=1.0 ${sha('other')}`, `fonts-a=1.0 ${sha('good')}`, `fonts-b=2.0 ${sha('bad?')}`].join('\n') + '\n');

    const out = w.run('restore');

    expect(out.status, out.stderr).toBe(0);
    expect(readdirSync(w.archives)).toEqual(['fonts-a_1.0.deb']);
    expect(out.stdout).toContain('버림 fonts-b_2.0.deb');
    expect(out.stdout).toContain('버림 fonts-c_3.0.deb');
  });

  it('restore — 캐시 폴더가 없으면 아무것도 안 넣고 지난다(첫 실행)', () => {
    const w = world();
    const out = spawnSync('bash', [SCRIPT, 'restore', join(w.root, 'none')], {
      encoding: 'utf8',
      env: { ...process.env, APT_ARCHIVES: w.archives, SUDO: '' },
    });
    expect(out.status, out.stderr).toBe(0);
    expect(readdirSync(w.archives)).toEqual([]);
  });

  it('collect — 받는 자리에서 지금 깔린 판만 거두고, 되살린 옛 판과 캐시 폴더의 옛 것은 버린다', () => {
    const w = world();
    writeFileSync(join(w.archives, 'fonts-a_1.0.deb'), 'old');
    writeFileSync(join(w.archives, 'fonts-a_1.1.deb'), 'new');
    writeFileSync(join(w.archives, 'fonts-z_9.deb'), 'gone');
    writeFileSync(join(w.cache, 'stale_0.deb'), 'stale');
    writeFileSync(join(w.root, 'installed'), 'fonts-a 1.1\n');

    const out = w.run('collect');

    expect(out.status, out.stderr).toBe(0);
    expect(readdirSync(w.cache)).toEqual(['fonts-a_1.1.deb']);
  });
});
