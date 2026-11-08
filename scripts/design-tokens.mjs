/**
 * **디자인 토큰을 한 원본에서 낸다**(ADR 0109 추기 2026-10-31) — 원본 `src/lib/design/tokens.json` 에서 웹 `app/globals.css` 의 표시된 칸과
 * 앱이 부르는 `src/lib/design/tokens.generated.ts` 를 짓는다. 값을 고치는 자리는 원본 하나다.
 *
 *     node scripts/design-tokens.mjs          # 쓴다
 *     node scripts/design-tokens.mjs --check  # 어긋나면 붉다(`scripts/design-tokens.test.ts` 도 같은 것을 잰다)
 *
 * 값이 적어 작은 스크립트로 충분하다 — Style Dictionary 같은 의존성을 들이지 않는다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CSS_PATH = 'app/globals.css';
export const TS_PATH = 'src/lib/design/tokens.generated.ts';
const TONES = ['wood', 'fire', 'earth', 'metal', 'water', 'none'];

const camel = (name) => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
const px = (value) => (value.endsWith('rem') ? parseFloat(value) * 16 : parseFloat(value));
const lines = (entries, prefix, indent) => Object.entries(entries).map(([name, value]) => `${indent}--${prefix}${name}: ${value};`).join('\n');

const isTone = (name) => TONES.some((tone) => name === tone || name === `${tone}-soft` || name === `${tone}-mid`);

/** 색의 앱 이름은 Tailwind 의 이름과 같다 — `--text-secondary` 는 `text-secondary` 로 부르므로 `secondary` */
function colorsOf(values) {
  const colors = {};
  for (const [name, value] of Object.entries(values)) {
    if (!isTone(name) && !name.startsWith('elevation-')) colors[camel(name.replace(/^text-/, ''))] = value;
  }
  return colors;
}

const tonesOf = (values) => Object.fromEntries(TONES.map((tone) => [tone, { ink: values[tone], soft: values[`${tone}-soft`], mid: values[`${tone}-mid`] }]));

const elevationsOf = (values) =>
  Object.fromEntries(Object.entries(values).filter(([name]) => name.startsWith('elevation-')).map(([name, value]) => [name.slice('elevation-'.length), value]));

const numbers = (values) => Object.fromEntries(Object.entries(values).map(([name, value]) => [name, px(value)]));
const ms = (value) => (value.endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000);

/** `#rrggbb` 에 투명도를 얹은 글자 — 1 이면 그 색 그대로 */
export function rgbaOf(hex, alpha) {
  if (alpha === 1) return hex;
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * **색 + 투명도의 이름**(`mix`) — 화면 색 모드를 따르는 토큰(`danger`)이나 안 따르는 색(`fixed` 의 흰 · 검정) 하나에 투명도를 얹는다.
 * 앱은 그 화면의 값으로 푼 `rgba(…)` 를, 웹은 Tailwind 의 `/40` 과 같은 `color-mix` 를 받아 어두운 화면에서도 제 토큰을 따른다.
 */
const mixesOf = (values, tokens) =>
  Object.fromEntries(Object.entries(tokens.mix ?? {}).map(([name, { of, alpha }]) => [camel(name), rgbaOf(tokens.fixed?.[of] ?? values[of], alpha)]));

const mixCss = (tokens) =>
  Object.fromEntries(
    Object.entries(tokens.mix ?? {}).map(([name, { of, alpha }]) => {
      if (tokens.fixed?.[of] !== undefined) return [name, rgbaOf(tokens.fixed[of], alpha)];
      return [name, alpha === 1 ? `var(--${of})` : `color-mix(in oklab, var(--${of}) ${Math.round(alpha * 100)}%, transparent)`];
    }),
  );

/** 표시된 칸의 속만 바꾼다 — 칸 밖은 사람이 쓰는 CSS 다 */
export function regionsInto(css, tokens) {
  const regions = {
    light: lines(tokens.light, '', '  '),
    dark: lines(tokens.dark, '', '    '),
    text: lines(tokens.text, 'text-', '  '),
    radius: lines(tokens.radius, 'radius-', '  '),
    mix: lines(mixCss(tokens), 'color-', '  '),
    motion: [lines(tokens.motion ?? {}, 'motion-', '  '), lines(tokens.easing ?? {}, 'motion-ease-', '  ')].join('\n'),
  };
  return Object.entries(regions).reduce((text, [name, body]) => {
    const pattern = new RegExp(`(/\\* design-tokens:${name} [^\\n]*\\*/\\n)[\\s\\S]*?(\\n\\s*/\\* /design-tokens:${name} \\*/)`);
    if (!pattern.test(text)) throw new Error(`${CSS_PATH} 에 design-tokens:${name} 칸이 없다`);
    return text.replace(pattern, (_, open, close) => `${open}${body}${close}`);
  }, css);
}

export function typescriptOf(tokens) {
  const constant = (name, value, note) => `/** ${note} */\nexport const ${name} = ${JSON.stringify(value, null, 2)} as const;\n`;
  return [
    '/* 지은 파일이다 — 손대지 말고 `src/lib/design/tokens.json` 을 고친 뒤 `node scripts/design-tokens.mjs` 를 돈다. */\n',
    constant('COLOR', { ...colorsOf(tokens.light), ...mixesOf(tokens.light, tokens) }, '밝은 화면의 색 — Tailwind 의 `--color-*` 이름. 뒤쪽은 색 + 투명도(`mix`)'),
    constant('COLOR_DARK', { ...colorsOf(tokens.dark), ...mixesOf(tokens.dark, tokens) }, '어두운 화면의 색 — 앱은 아직 안 쓴다'),
    constant('FIXED', tokens.fixed, '화면 색 모드를 안 따르는 색 — 사진 위 · 사진 보기의 흰 · 검정'),
    constant('TONE', tonesOf(tokens.light), '오행 한 벌 — 글자 · 면 · 상징의 속. `none` 은 오행을 모를 때'),
    constant('TONE_DARK', tonesOf(tokens.dark), '어두운 화면의 오행 — 앱은 아직 안 쓴다'),
    constant('ELEVATION', elevationsOf(tokens.light), '그림자 다섯 단 — 웹 문법 글자 그대로. React Native 의 `boxShadow` 가 받는다'),
    constant('ELEVATION_DARK', elevationsOf(tokens.dark), '어두운 화면의 그림자 — 앱은 아직 안 쓴다'),
    constant('TEXT', numbers(tokens.text), '글자 크기의 단(px)'),
    constant('RADIUS', { ...numbers(tokens.radius), pill: tokens.pill }, '모서리 세 단(px) — 카드 · 칸 · 알약'),
    constant('MOTION', Object.fromEntries(Object.entries(tokens.motion).map(([name, value]) => [name, ms(value)])), '움직임의 시간(ms) — 누름의 전환 · 뼈대의 반짝임 · 끝 모르는 띠'),
    constant('EASING', tokens.easing, '움직임의 이징 — CSS 낱말. 앱은 `mobile/src/ui/motion.ts` 가 같은 이름의 `Easing` 으로 푼다'),
  ].join('\n');
}

export function generated() {
  const tokens = JSON.parse(readFileSync(join(ROOT, 'src/lib/design/tokens.json'), 'utf8'));
  return {
    [CSS_PATH]: regionsInto(readFileSync(join(ROOT, CSS_PATH), 'utf8'), tokens),
    [TS_PATH]: typescriptOf(tokens),
  };
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const check = process.argv.includes('--check');
  let stale = false;
  for (const [path, body] of Object.entries(generated())) {
    let current = '';
    try {
      current = readFileSync(join(ROOT, path), 'utf8');
    } catch {}
    if (current === body) continue;
    if (check) {
      console.error(`${path} 이 원본과 어긋난다 — node scripts/design-tokens.mjs 를 돈다`);
      stale = true;
    } else {
      writeFileSync(join(ROOT, path), body);
      console.log(`${path} 를 지었다`);
    }
  }
  if (stale) process.exit(1);
}
