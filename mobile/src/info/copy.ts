import { SUPPORT_EMAIL } from '@brand';

/**
 * **앱에만 서는 설정 · 안내의 글자** — 웹은 바닥글이고 앱은 설정의 무리라 이름이 웹 코드에 없다. 글자는 대장 settings-14 에 있고
 * `scripts/mobile-info-copy.test.ts` 가 그 대장과 견준다.
 */
export const SUPPORT_TITLE = '고객센터';
export const POLICY_TITLE = '약관 및 정책';
export const CONTACT_LABEL = '문의하기';
export const SEND_MAIL_LABEL = '메일 보내기';
export const SURVEY_LABEL = '서비스 설문';
export const BUSINESS_LABEL = '사업자 정보';
/** 글자는 대장 public-02 확정이다 — 오류 화면 · 고객센터가 같은 줄을 쓴다 */
export const SUPPORT_MAIL_LINE = `궁금한 점은 ${SUPPORT_EMAIL}으로 보내 주세요.`;
export const MAIL_FAILED = '메일 앱을 열지 못했어요. 위 주소로 보내 주세요.';
/** 약관 셋의 머리 아래 한 줄 — 앱은 글을 빌드에 담아(OTA 없음) 웹이 개정되면 설치된 앱이 옛 글을 보인다. 대장 settings-16 */
export const BUNDLED_TEXT_NOTE = '지금 설치된 앱 버전에 담긴 내용이에요. 최신 내용은 웹에서 확인해 주세요.';
export const LATEST_ON_WEB_LABEL = '웹에서 최신 내용 보기';
