/**
 * **전후 그림을 화소로 견준다** — `node scripts/ui-shots-diff.mjs <전 폴더> <후 폴더>`.
 *
 * `scripts/ui-shots.mjs` 가 찍은 두 벌에서 같은 이름의 그림을 짝지어 파일마다 한 줄을 찍는다 —
 * `same` · `DIFF <화소 수> box x..-.. y..-..` · `SIZE`(크기 다름) · `MISSING`(한쪽에만) — 그리고 요약 한 줄.
 * 다른 쌍은 차이 상자 둘레를 전 | 후 나란히 붙인 크롭으로 `<후 폴더>/diff-crops/` 에 남긴다. 다른 쌍 · 빠진 쌍이 있으면 종료 1.
 *
 * 세션마다 이 비교를 새로 쓰고 있었다(11-20 한 세션에 셋). 씨앗이 판마다 달라 거의 다 「다름」이던 것은
 * `UI_SEED_TAG` 가 걷는다(`scripts/ui-seed.mjs` 의 `seedTag`) — 그 뒤에 남는 차이는 DB 가 찍는 시각과 움직임이다.
 *
 * 그림은 JPEG 다(`quality: 72`). 같은 화면이면 같은 바이트가 나오지만, 화소 하나의 값이 조금 흔들리는 일을 「다름」으로
 * 세지 않도록 채널마다 `UI_DIFF_TOLERANCE`(기본 16) 이하의 차이는 같다고 본다. 0 이면 한 값이라도 다르면 다르다.
 */

import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

/** 견주는 그림 — `ui-shots` 는 JPEG 를 찍고, 손으로 넣은 PNG 도 받는다 */
const PICTURE = /\.(jpe?g|png)$/i;

/** 크롭 폴더 — 후 폴더 안에 두되, 다음 비교가 그림으로 세지 않도록 맨 위가 아닌 하위 폴더다 */
export const CROPS = 'diff-crops';

/**
 * 두 그림의 화소를 견준다 — **순수하다.** `a` · `b` 는 `{ width, height, channels, data }`(sharp 의 raw 출력 꼴).
 *
 * 크기가 다르면 `{ size: true }`, 아니면 다른 화소 수와 그것을 다 덮는 상자(`null` 이면 같음).
 */
export function comparePixels(a, b, tolerance = 16) {
  if (a.width !== b.width || a.height !== b.height) return { size: true, count: 0, box: null };
  const channels = Math.min(a.channels, b.channels, 3);
  let count = 0;
  let left = Infinity;
  let top = Infinity;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      const at = y * a.width + x;
      let differs = false;
      for (let c = 0; c < channels && !differs; c += 1) {
        differs = Math.abs(a.data[at * a.channels + c] - b.data[at * b.channels + c]) > tolerance;
      }
      if (!differs) continue;
      count += 1;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return { size: false, count, box: count === 0 ? null : { left, top, right, bottom } };
}

/** 한 쌍의 판정 줄 — 파일 이름 다음에 붙는다 */
export function verdictLine(result) {
  if (result.missing) return `MISSING (${result.missing} 에만)`;
  if (result.size) return 'SIZE';
  if (result.box === null) return 'same';
  const { left, top, right, bottom } = result.box;
  return `DIFF ${result.count} box x${left}-${right} y${top}-${bottom}`;
}

/** 두 폴더의 그림 이름을 짝짓는다 — 이름 차례로, 한쪽에만 있는 것은 그쪽을 적는다 */
export function pairUp(before, after) {
  const names = [...new Set([...before, ...after])].filter((one) => PICTURE.test(one)).sort();
  return names.map((name) => ({
    name,
    missing: !before.includes(name) ? 'after' : !after.includes(name) ? 'before' : null,
  }));
}

/** 요약 한 줄과 종료 값 — 다른 쌍 · 크기 다름 · 빠진 쌍이 하나라도 있으면 1 */
export function summarize(results) {
  const counts = { same: 0, diff: 0, size: 0, missing: 0 };
  for (const one of results) {
    if (one.missing) counts.missing += 1;
    else if (one.size) counts.size += 1;
    else if (one.box === null) counts.same += 1;
    else counts.diff += 1;
  }
  const line = `${results.length}쌍 — same ${counts.same} · DIFF ${counts.diff} · SIZE ${counts.size} · MISSING ${counts.missing}`;
  return { line, counts, exitCode: counts.diff + counts.size + counts.missing > 0 ? 1 : 0 };
}

/** 상자 둘레를 `pad` 만큼 넓혀 그림 안으로 자른 자리 — 긴 화면 전체가 달라도 크롭은 `maxHeight` 를 넘지 않는다 */
export function cropRegion(box, width, height, pad = 40, maxHeight = 1600) {
  const left = Math.max(0, box.left - pad);
  const top = Math.max(0, box.top - pad);
  const right = Math.min(width - 1, box.right + pad);
  const bottom = Math.min(height - 1, box.bottom + pad, top + maxHeight - 1);
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

const raw = async (file) => {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, channels: info.channels, data };
};

/** 전 | 후 를 나란히 — 가운데 8px 붉은 띠로 가른다 */
async function writeCrop(beforeFile, afterFile, region, target) {
  const gap = 8;
  const [left, right] = await Promise.all(
    [beforeFile, afterFile].map((file) => sharp(file).extract(region).png().toBuffer()),
  );
  await sharp({
    create: { width: region.width * 2 + gap, height: region.height, channels: 3, background: '#d33' },
  })
    .composite([
      { input: left, left: 0, top: 0 },
      { input: right, left: region.width + gap, top: 0 },
    ])
    .png()
    .toFile(target);
}

async function main(beforeDir, afterDir) {
  const tolerance = Number(process.env.UI_DIFF_TOLERANCE ?? 16);
  const crops = join(afterDir, CROPS);
  await rm(crops, { recursive: true, force: true });

  const [before, after] = await Promise.all([readdir(beforeDir), readdir(afterDir)]);
  const results = [];
  for (const pair of pairUp(before, after)) {
    if (pair.missing) {
      results.push(pair);
      console.log(`${pair.name}  ${verdictLine(pair)}`);
      continue;
    }
    const beforeFile = join(beforeDir, pair.name);
    const afterFile = join(afterDir, pair.name);
    const [a, b] = await Promise.all([raw(beforeFile), raw(afterFile)]);
    const result = { name: pair.name, ...comparePixels(a, b, tolerance) };
    results.push(result);
    console.log(`${pair.name}  ${verdictLine(result)}`);
    if (result.box !== null) {
      await mkdir(crops, { recursive: true });
      const region = cropRegion(result.box, a.width, a.height);
      await writeCrop(beforeFile, afterFile, region, join(crops, pair.name.replace(PICTURE, '.png')));
    }
  }

  const { line, counts, exitCode } = summarize(results);
  console.log(`\n${line}${counts.diff > 0 ? ` — 크롭(전 | 후): ${crops}/` : ''}`);
  return exitCode;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [beforeDir, afterDir] = process.argv.slice(2);
  if (!beforeDir || !afterDir) {
    console.error('쓰는 법: node scripts/ui-shots-diff.mjs <전 폴더> <후 폴더>');
    process.exit(2);
  }
  process.exitCode = await main(beforeDir, afterDir);
}
