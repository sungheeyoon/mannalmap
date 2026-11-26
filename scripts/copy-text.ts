import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * **앱 문구 시험(`scripts/mobile-*-copy.test.ts`)이 함께 쓰는 글자 도구 한 벌** — 「앱의 글자가 웹 코드에 그대로 있나」를 재는 손이다.
 *
 * 견주는 두 쪽을 **같은 손으로** 읽는다(`codeText`). 앱 쪽만 주석을 걷고 웹 쪽은 주석째 읽던 때는, 웹 화면에서 글자를 지우고
 * 주석에만 남겨도 초록이었다 — 그 구멍은 `copy-text.test.ts` 가 붉게 잰다.
 */
export const ROOT = join(import.meta.dirname, '..');

/** 저장소 뿌리에서 센 경로의 파일 글 */
export const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

/**
 * 주석을 걷는다 — JSX 의 `{/* … *\/}` · 블록 주석 · 줄 전체가 주석인 `//`.
 * 줄 끝의 `//` 는 둔다 — 글 속의 주소(`https://`)와 갈라 읽지 못한다.
 */
export const withoutComments = (text: string) =>
  text.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** 공백 · 줄바꿈을 한 칸으로 — JSX 가 글자를 여러 줄로 접어도 같은 글로 읽는다 */
export const flat = (text: string) => text.replace(/\s+/g, ' ');

/** 한글로 시작해 따옴표 · 중괄호 · 꺾쇠 · 줄바꿈 · 틀 글자의 `${` 앞까지 — 글자 조각 하나. 주석 속 글자는 안 센다 */
export const koreanChunks = (text: string) =>
  [...withoutComments(text).matchAll(/[가-힣][^'"`{}<>\n$]*/g)].map((match) => match[0].trim());

/** 견줄 쪽의 코드 글 — 파일마다 주석을 걷고 이어 붙여 공백을 한 칸으로 */
export const codeText = (files: readonly string[]) => flat(files.map((file) => withoutComments(read(file))).join('\n'));

/** 앱 파일의 글자 조각 가운데 `web`(`codeText` 의 답)에 그대로 없는 것 */
export const straysFrom = (appFile: string, web: string) => koreanChunks(read(appFile)).filter((chunk) => !web.includes(flat(chunk)));
