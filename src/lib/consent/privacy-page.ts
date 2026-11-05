/**
 * **처리방침 화면이 `noticeFor` 밖에서 세우는 글** — 고지한 판의 글자라 웹과 앱이 이 한 벌을 읽는다. 조항 본문은 `notice.ts` 다.
 */
export const PRIVACY_INTRO = '이 서비스가 개인정보를 어떻게 다루는지 적었습니다.';
export const PRIVACY_OPTIONAL_TITLE = '선택 항목';
export const PRIVACY_RIGHTS_TITLE = '확인하고 고치고 지우는 방법';

export const PRIVACY_RIGHTS_LINES = [
  '내 출생 정보는 프로필 화면에서, 등록한 가족·친구의 출생 정보는 저장한 사람 화면에서 언제든 고칠 수 있습니다.',
  '선택 동의는 설정 화면에서 켜고 끌 수 있습니다.',
  '계정과 저장된 정보의 삭제는 설정 화면에서 요청하실 수 있습니다. 상세 궁합이 열려 있던 상대가 있다면 그 결과는 양쪽 화면에서 함께 사라집니다.',
  '문의는 위 「권리와 행사 방법」의 연락처로 보내 주시면 됩니다. 운영자가 직접 답합니다.',
] as const;

export const privacyPurgeNote = (purgeWithinDays: number): string =>
  `정보 파기 시점은 위 운영 기간의 끝을 기준으로 합니다(끝난 후 ${purgeWithinDays}일 이내). 운영 기간이 바뀌면 이 방침을 다시 알려 드립니다.`;
