import { pathWithin } from '@/src/lib/app-shell';
import { SHARE_ROOTS } from '@/src/lib/reading/share-path';

/** 지금 보고 있는 화면이 공유본인가 — 헤더가 묻는다 */
export function isSharePath(pathname: string): boolean {
  return Object.values(SHARE_ROOTS).some((root) => pathWithin(pathname, root));
}
