# 레퍼런스 모음 — 화면 꼴별 한국 서비스 사례

색인은 `GLOSSARY.md` 다. 이 파일은 용어가 아니라 **이미 찾은 레퍼런스의 모음**이다 — 날짜 노트가 아니라 계속 고쳐 쓰는 표다.
요구사항도 결정도 아니고, 그대로 베끼라는 뜻도 아니다. 사례가 저장소의 결정(ADR · PRD · 대장 · 용어집)과 어긋나면 결정이 앞선다.
찾는 차례 · 확인 수준(A~D) · 사례를 남기는 자리는 `docs/agents/code-rules/references.md` 「레퍼런스」가 정한다.

**어떻게 더하나.** 대장의 출처 칸 · ADR 의 「까닭」 · 간극 기록에 사례를 적은 PR 이 같은 차례에 여기 그 화면 꼴의 표에 한 줄을 더한다 —
서비스 · 무엇(원문 인용이나 숫자) · 출처 링크 · 확인 날짜 · 수준 · 쓴 자리(대장 절 번호 · ADR 번호 · `G-nn 기록`). 같은 링크가 이미 있으면 「쓴 자리」에만
덧붙인다. 맞는 꼴이 없으면 `###` 제목을 새로 연다 — 이 폴더의 `##` 절은 용어집의 절 번호라 여기서는 쓰지 않는다. 대장 · ADR 은 이 파일의 꼴 제목 앵커
(예: `#결제--구매--환불--풀이권`)로 가리킬 수 있다.

**처음 채운 것(2026-11-19).** 새로 조사하지 않고 저장소에 이미 적힌 사례를 옮겼다 — `docs/notes/2026-11-02-korean-app-flow-references.md` · 문구 대장의
출처 칸 · ADR 의 근거(쓴 자리 칸의 번호, SEED · TDS 는 ADR 0109) · 간극 기록(`docs/product/gaps/records/`). 「확인」은 그 자리에 적힌 확인 날짜이고, 그 자리에
날짜가 없으면 「날짜 없음」, 출처가 링크 없이 적혔으면 「링크 없음」이다. 「수준」은 그 자리가 적은 것만 옮겼다 — 적지 않았으면 `—` 다. 같은 사실에 두 자리가
다른 수준을 적었으면 둘 다 적었다. 법 조문 · 결제 대행 · SDK · 개발 문서처럼 이용자가 보는 화면이 아닌 링크는 옮기지 않았다 — 법률 근거는 `docs/legal/README.md`.
`(해외)` 는 보조다 — 해외 사례만으로 정하지 않는다. 남의 화면은 바뀌므로 다시 쓰기 전에 링크를 다시 연다.

### 로그인 · 가입 (소셜 로그인 단추 포함)

| 서비스 | 무엇 | 출처 | 확인 | 수준 | 쓴 자리 |
| --- | --- | --- | --- | --- | --- |
| 정통사주 | 「회원가입 없이 바로 이용」 · 「별도 서버 저장 없이 앱 안에서만 관리」 · 사용자 여러 명 추가 | [App Store](https://apps.apple.com/kr/app/id1178530910) | 2026-11-02 | A′ | 11-02 노트 §1 · §3 |
| 잘맞는운세 | 「회원가입같은 번거로운 절차없이 바로 이용」 · 입력 정보는 휴대폰에만 저장 | [App Store](https://apps.apple.com/us/app/id364575067?l=ko) | 2026-11-02 | C | 11-02 노트 §1 · §3 |
| 헬로우봇 | 「…대화 기록을 안전하게 보관하세요.」 · 「로그인 후에 바로 써볼 수 있어요」 · 「결제 전, 먼저 로그인을 해주세요」 … | [문구표](https://hellobot.co/terms) | 2026-11-02 | B′ | 11-02 노트 §3 · §4 · first-02 · public-04 |
| 윌유 | 「PASS 인증 필수: 가입 시 본인 명의의 휴대폰 검증」 — 묻는 곳이 가입 시점 | [App Store](https://apps.apple.com/kr/app/id1644080758) | 2026-11-02 | B | 11-02 노트 §3 |
| velog | 로그인 · 가입 창 아래 「계정이 이미 있으신가요?」 + 「로그인」 | [웹](https://velog.io/) | 2026-11-05 | — | first-04 · ADR 0226 |
| TVING | 가입 화면 「이미 계정이 있나요?」 + 「로그인」 | [웹](https://www.tving.com/) | 2026-11-05 | — | first-04 · ADR 0226 |
| 점신 | 웹 첫 화면 「기존 회원 로그인하기」 | [웹](https://www.jeomsin.co.kr/) | 2026-11-05 | — | first-04 |
| 위버스 | 황도 MEMBERSHIP 공지 「신규 가입 … 일시 중단」 | [공지](https://weverse.io/hwangminhyun/notice/18156?hl=ko) | 2026-11-05 | — | public-08 |
| LG유플러스 | 공지 「신규 가입을 받지 않습니다」 | [공지](https://www.lguplus.com/support/service/notice/2000047446) | 2026-11-05 | — | public-08 |
| LG전자 | 고객지원 공지의 「카카오, 구글 등의 계정」 간편 로그인 안내 | [공지](https://www.lge.co.kr/support/notice-NTC20220407151001) | 2026-11-06 | — | public-12 |
| 헬로우봇 | 가입 화면 「[필수] 만 14세 이상입니다.」 | [화면 글 원본](https://hellobot.co/privacy) | 2026-11-07 | — | public-13 |
| 헬로우봇 | 가입 화면 「[필수] 만 14세 이상입니다.」 · 「만 14세 미만은 회원 서비스를 이용할 수 없습니다.」 | [약관](https://hellobot.co/terms/service) | 2026-11-06 | — | ADR 0231 |
| 점신 · 포스텔러 · 헬로우봇 | 종료일을 걸지 않는다(출처는 #938 댓글) | 링크 없음 | 2026-11-06 | — | ADR 0225 |
| 크몽 | 카카오 · 네이버 · 페북 · 구글 · 애플 · 이메일, 막고 안내 + 수동 — 「이미 가입된 계정임을 바로 알려드려요」 | [방침](https://kmong.com/support/customer-center/posts/806) · [공지](https://kmong.com/support/customer-center/posts/59) | 2026-11-02 | — | ADR 0219 |
| 캐럿 | 카카오 · 구글 · 애플 · 이메일 — 「'계정 통합'은 불가합니다. 로그인 수단별로 각각 독립적인 계정이 생성」 | [방침](https://carat.im/privacy-2) · [FAQ](https://carat.im/docs/ko/troubleshooting/account/email-login-faq.md) | 2026-11-02 | — | ADR 0219 |
| DBpia · 점신 · 아만다 | 애플 로그인이 있고, 계정 연결 · 중복 처리는 「못 찾음」 | [DBpia](https://dbpia.co.kr/link/privacy) · [점신](https://www.jeomsin.co.kr/policy/) · [아만다](https://amandahub.co.kr/amanda/privacy/terms_index.html) | 2026-11-02 | — | ADR 0219 |
| 미러 | 구글 · 애플, 휴대전화 본인확인으로 중복 방지 | [방침](https://mirror-apps.com/privacy) | 2026-11-02 | — | ADR 0219 |
| 왓챠피디아 | 카카오 → Apple → Google → X → LINE → 이메일 · 48 · 6px · 「카카오로 로그인」 · 아이콘 왼쪽 | [로그인](https://pedia.watcha.com/ko-KR/sign_in) | 2026-11-05 · 2026-11-06 | — | ADR 0228 |
| 무신사 | 카카오 → Apple → 이메일 · 40 · 4px · 「카카오로 시작하기」 · 흰 단추 선 #E0E0E0 | [로그인](https://www.musinsa.com/auth/login) | 2026-11-05 · 2026-11-06 | — | ADR 0228 |
| 29CM | 무신사 통합 → 카카오 → Apple · 44 · 4px · 「카카오로 계속하기」 · 흰 단추 선 #DDDDDD | [로그인](https://www.29cm.co.kr/member/login) | 2026-11-05 · 2026-11-06 | — | ADR 0228 |
| 리멤버 · 리디 | 카카오 → 네이버 → 구글 → Apple(원형 아이콘), 글자 없이 아이콘 · 흰 바탕 단추만 1px 회색 | [리멤버](https://career.rememberapp.co.kr/login) · [리디](https://ridibooks.com/account/login) | 2026-11-05 | — | ADR 0228 |
| 숨고 | 카카오 → 네이버 · 52 · 12px · 「카카오로 시작하기」 · 데스크톱은 좁은 한 열(카드 420 · 단추 338) | [로그인](https://soomgo.com/login) | 2026-11-05 · 2026-11-06 | — | ADR 0228 |
| KREAM | 네이버 → Apple · 52 · 10px · 600 · 15px | [로그인](https://kream.co.kr/login) | 2026-11-05 | — | ADR 0228 |

### 공유 · 앱으로 열기

| 서비스 | 무엇 | 출처 | 확인 | 수준 | 쓴 자리 |
| --- | --- | --- | --- | --- | --- |
| 굿닥 · 무신사 · 원티드 · 리멤버 | 굿닥 「‘웹으로 계속하기’도 닫기 역할로 … 눈에 띄진 않습니다.」 · 무신사 · 원티드 · 리멤버는 시트에 앱 아이콘 | [요즘IT 2021-09-16](https://yozm.wishket.com/magazine/detail/1030) | 2026-11-13 | — | public-19 · ADR 0247 |

### 결제 · 구매 · 환불 · 풀이권

| 서비스 | 무엇 | 출처 | 확인 | 수준 | 쓴 자리 |
| --- | --- | --- | --- | --- | --- |
| 오!사주 | 사용 단위 표시 | [웹](https://saju.orijima.com/) | 2026-10-12 | — | credits-06 |
| 네이버웹툰 | 부족 수량 확인 후 구매 구조 | [도움말](https://help.naver.com/service/5635/contents/8499?lang=ko&osType=ANDROID) | 2026-10-12 | — | credits-04 · credits-06 · ADR 0171 |
| 네이버 시리즈 · 카카오페이지 | 이용권을 「장」으로 센다 — 「이용권을 각각 1장씩 제공」 · 「이용권 한 장당 한 편」 | 링크 없음 | 2026-10-12 | — | all-02 · credits-08 |
| 리디 · 네이버 시리즈 | 잔액 칸에 결제 내역 길을 두지 않는다(「마이리디 > 리디캐시 > 충전내역」 · 「MY > 쿠키 내역」) | 링크 없음 | 2026-10-12 | — | ADR 0171 |
| 리디 | 결제일로부터 7일 안 · 미사용이면 「충전내역」에서 직접 결제취소, 그 밖에는 고객센터 접수로 잔액 환불 | [도움말](https://ridihelp.ridibooks.com/support/solutions/articles/154000207862) | 2026-10-12 | — | ADR 0174 · credits-02 |
| 서비스 이름 없음 | 동의 문구 예 「환불정책 및 판매 조건을 확인하였으며 이에 동의합니다」 | [X 게시물](https://x.com/beombeombeom00/status/2031759580070625413) | 2026-10-12 | — | ADR 0174 · credits-02 |
| 리디 | 동의 체크 + 충전 단추 아래 작은 글씨 유의사항 · 「결제 후 7일 이내 · 일부 쓰면 취소 불가」는 안 씀 | 링크 없음 | 2026-10-12 | — | credits-03 · credits-11 · ADR 0175 · G-21 기록 |
| 리디 | 「충전 후 결제」 — 결제 뒤 하던 화면으로 돌아가기의 근거 | [도움말](https://ridihelp.ridibooks.com/support/solutions/articles/154000207846) | 2026-10-29 | — | ADR 0171 · credits-10 |
| Careem Pay (해외) | 결제 연동 가이드 「Do not dump the user back on the home page」 | [가이드](https://implicit.readthedocs.io/en/latest/checkout-ux-best-practices.html) | 2026-10-29 | — | ADR 0171 |
| 카카오페이지 | 「캐시를 충전한 날로부터 5년」 | [도움말](https://cs.kakao.com/helps_html/1073201003?locale=ko) · [약관](https://page.kakao.com/policy/terms-paid) | 2026-10-12 | — | ADR 0173 |
| 점신 | 약관 제14조⑤ 「회사가 회원에게 무상으로 지급한 코인 및 아이템은 … 지급 후 1년 경과 시 소멸됩니다」 | [약관](https://www.jeomsin.co.kr/agree/0907.php) | 2026-10-12 · 2026-11-02 | — | ADR 0173 · ADR 0235 |
| 넥슨 | 넥슨캐시 제10조 「잔액에서 10%의 환불수수료를 공제」 — 이름 「환불수수료」의 근거 | [약관](https://member.nexon.com/policy/policywrapper.aspx?date=20251016&policytype=32) | 2026-10-20 | — | credits-09 · ADR 0192 |
| 네이버웹툰 | 「취소 수수료」(환불금액의 10% 공제) | [도움말](https://help.naver.com/service/5635/contents/19306?lang=ko&osType=ANDROID) | 2026-10-20 | — | credits-09 · ADR 0192 |
| 리디 | 이용약관 제22조 「잔액 환급 비율(90%)」 | [약관](https://policy.ridi.com/legal/terms/) | 2026-10-20 | — | ADR 0192 |
| 리디 | 이용약관 제28조 「리디캐시는 … 회원 탈퇴 시 소멸됩니다.」 · 제29조 「리디포인트는 … 회원 탈퇴 시 소멸됩니다.」 · 제5조 「… 유효기간 임박, 소멸 등에 관한 안내」(v5.0 에서 읽었고 v5.1 에도 같다) | [약관](https://policy.ridi.com/legal/terms/) | 2026-10-17 · 2026-11-19 | A | ADR 0191 · G-25 기록 |
| 카카오비즈니스 | 「무상캐시와 유상캐시가 모두 있는 경우, 무상캐시가 우선 소진됩니다.」 | [가이드](https://kakaobusiness.gitbook.io/main/ad/searchad/keywordad/run/payment) | 2026-10-17 | — | ADR 0191 |
| 당근페이 | 이용약관 제17조 「구매자는 판매자의 안심결제 거래 수락 이전 안심결제 거래를 취소할 수 있습니다.」 | [약관](https://terms.daangnpay.com/service) | 2026-10-26 | — | all-06 |
| 카카오페이 | 이용약관 「해당 거래를 취소할 수 있습니다」 | [약관](https://www.kakaopay.com/terms/service) | 2026-10-26 | — | all-06 |
| 미툰 | 코인 회차 팝업 「이번 회차는 코인이 필요한 회차입니다. 부족한 코인을 충전해 주세요.」 — 충전 뒤 하던 일로 | [웹](https://me.co.kr/) | 2026-11-13 | — | credits-14 · ADR 0251 |
| 사주나루 | 상담 중 충전 — 상담이 끊기지 않게 코인을 채운다 | [웹](https://www.sajunaru.com/coin.html) | 2026-11-13 | — | credits-14 · ADR 0251 |
| 헬로우봇 | 「이미 결제를 진행중입니다.」 · 「결제완료」 · 「결제실패」 + 「죄송합니다. …」 · 「잠시 후 다시 시도하거나 …」 | [문구 파일](https://hellobot.co/assets/i18n/ko.json) | 2026-11-06 · 2026-11-18 | — | credits-11 · credits-15 · credits-16 · ADR 0230 |
| 포스텔러 | 웹 결제 실패 「결제가 완료되지 않았습니다.」 · 결제 완료 창은 단추 「확인」 하나 | [웹](https://www.forceteller.com) | 2026-11-06 | — | credits-11 · ADR 0230 |
| 네이버웹툰 | 「"쿠키 충전이 완료되지 않았습니다." 팝업」 · 같은 상품을 다시 누르면 충전 · 「최대 6시간 이후 …재시도해 보세요.」 | [도움말](https://help.naver.com/service/5635/contents/11545?osType=ANDROID) | 2026-11-06 · 2026-11-18 | — | credits-11 · credits-15 · credits-16 |
| 네이버웹툰 | 「위험 거래로 판단되어 일정 시간 동안 결제 서비스 이용이 불가합니다.」(기간 제한이라 안 씀) | [도움말](https://help.naver.com/service/5635/contents/23985) | 2026-11-06 | — | credits-11 |
| 리디 | 「리디캐시 구매복원」은 iOS | [도움말](https://ridihelp.ridibooks.com/support/solutions/articles/154000207840) | 2026-11-06 | — | credits-11 |
| 리디 | 3일 자동 환불이 미지급을 푼다 | [도움말](https://ridihelp.ridibooks.com/support/solutions/articles/154000207863) | 2026-11-06 | — | credits-11 |
| 리디 | 도움말은 3일 자동 환불만 말한다(같은 자리 화면은 못 찾음) | [도움말](https://ridihelp.ridibooks.com/support/solutions/articles/154000207839) | 2026-11-18 | — | credits-16 |
| Google Play 고객센터 (해외) | 「거래가 완료되면 인앱 구매 항목을 이용할 수 있게 됩니다.」 — 한국 실사례 없는 보류 결제의 가장 가까운 것 | [고객센터](https://support.google.com/googleplay/answer/1050566?hl=ko) | 2026-11-06 · 2026-11-18 | — | credits-11 · credits-16 |
| 카카오페이지 · 리디 · 포스타입 | 부당 환불은 계정의 보유분에서 공제하거나 반환 청구 · 사전 통지 · 이의신청(카카오페이지) · 10일 소명(리디) | 링크 없음 | 2026-11-06 | — | ADR 0230 |
| 넥슨 · 코그 · 엔씨 | 마이너스(넥슨 바람의나라: 연) · 대체 재화 회수(코그) · 보너스 함께 뺌(엔씨) · 악용은 이용 전체 제한(넥슨 등) | 링크 없음 | 2026-11-06 | — | ADR 0230 |
| 네이버웹툰 | 쿠키가 iOS 120원, 안드로이드 100원 → 120원(2022-05-30) — 2022 보도, 검색 요약 | [디지털데일리](https://www.ddaily.co.kr/page/view/2022053117191404680) · [지디넷](https://zdnet.co.kr/view/?no=20220523181929) | 날짜 없음 | — | G-128 기록 |
| 웨이브 · 티빙 · 플로 | 앱 이용권을 15% 안팎 올렸다 — 2022 보도, 검색 요약 | [이코노미스트](https://economist.co.kr/article/view/ecn202206140051) | 날짜 없음 | — | G-128 기록 |
| 카카오페이지 | 캐시 내역 — 탭 「충전내역 / 사용내역」, 줄은 위 왼쪽 이름 · 위 오른쪽 값 · 아래 시각 · 상태, 빈 상태 「캐시 충전내역이 없습니다.」, 취소 · 환불은 빨강 | [웹](https://page.kakao.com/history/cash/) | 2026-11-21 | B′ | credits-18 · credits-19 · ADR 0263 |
| 카카오페이지 | 이용권 내역 — 위 왼쪽 이름 · 위 오른쪽 값 · 아래 시각의 줄 | [웹](https://page.kakao.com/history/ticket/) | 2026-11-21 | B′ | ADR 0263 |
| 포스텔러 | 「내 포스 내역」 — 잔액 한 줄 아래 「충전 내역 / 사용 내역」 탭 | [웹](https://www.forceteller.com/force/history) | 2026-11-21 | B′ | credits-18 · ADR 0263 |
| 밀리의서재 | 결제 내역의 상태 「환불 완료」 | [웹](https://www.millie.co.kr/v3/order/history) | 2026-11-21 | B′ | ADR 0263 |
| 토스 TDS | 목록의 보조 정보 · 상태를 오른쪽에 맞춘다 | [문서](https://tossmini-docs.toss.im/tds-mobile/llms-full.txt) | 2026-11-21 | A | credits-18 · ADR 0263 |

### 확인 창 · 시트 · 스낵바

| 서비스 | 무엇 | 출처 | 확인 | 수준 | 쓴 자리 |
| --- | --- | --- | --- | --- | --- |
| 토스 TDS | 「삭제할까요? / 이 작업은 되돌릴 수 없어요. / 삭제하기 · 취소」 · 「종료하기 · 취소」 · 「결제를 취소할까요?」 | [llms-full.txt](https://tossmini-docs.toss.im/tds-mobile/llms-full.txt) | 2026-10-26 | — | all-04 · all-06 · matching-09 |
| 토스 TDS | `ConfirmDialog` — 설명 한 줄 · 왼쪽 닫기 · 오른쪽 실행 | [ConfirmDialog](https://tossmini-docs.toss.im/tds-mobile/components/Dialog/confirm-dialog/) | 2026-10-24 · 2026-10-26 | — | settings-07 · ADR 0109 · ADR 0166 · ADR 0205 |
| 당근 SEED | Alert Dialog 「이 작업은 되돌릴 수 없습니다.」 · 가로 배열이 기본, 긴 라벨은 세로 | [Alert Dialog](https://seed-design.io/components/alert-dialog) | 2026-10-26 | — | all-04 · ADR 0109 · ADR 0166 |
| 당근 SEED | Snackbar 「한 문장이면 마침표를 생략」 · 단추는 하는 일을 말하고 「확인」 · 「취소」는 안 쓴다 | [Snackbar](https://seed-design.io/components/snackbar) | 2026-10-25 · 2026-10-26 | — | matching-09 · ADR 0109 |
| 카카오톡 | 차단 확인 창 「OO님을 차단하시겠습니까? / 차단하면 … 메시지를 받을 수 없으며, 친구목록에서 삭제됩니다.」 | [블로그](https://changwoos.tistory.com/227) | 2026-10-26 | — | all-04 |
| 카카오톡 · 당근 | 「이 소식을 삭제하시겠습니까?」 [취소] [삭제] · 당근 「정말 닉네임을 변경할까요?」 [취소] [변경하기] | 링크 없음 | 2026-10-24 | — | ADR 0205 |
| 카카오톡 | 「프로필 사진 설정」 판 — 바닥의 판 · 줄 · 따로 선 「취소」, 판 머리에 제목 · 그림 없음 | 링크 없음 | 2026-10-24 | — | ADR 0109 |
| 인스타그램 (해외) | 「미디어를 삭제하시겠어요?」 · 본문 한 줄(30일 복원) · 위아래 [삭제] [삭제 안 함] | [블로그](https://m.blog.naver.com/hansh0002/223573179120) | 2026-10-24 | — | settings-07 · ADR 0205 |
| Instagram (해외) | 「Tap Delete and then tap Delete again」 — 확인 단추가 메뉴와 같은 「삭제」 | [도움말](https://help.instagram.com/554684988067878) | 2026-10-23 | — | settings-06 |
| Apple 지원 (해외) | iPhone 사진 앱의 확인 단추 「사진 삭제」 | [지원](https://support.apple.com/ko-kr/104967) | 2026-10-23 | — | settings-06 |
| Apple 지원 (해외) | 「iCloud에서 '끄기 및 삭제하기'를 탭합니다. '끄기 및 삭제하기'를 탭하여 확인합니다」 | [지원](https://support.apple.com/ko-kr/108922) | 2026-10-25 | — | settings-08 |
| Google 계정 (해외) | 「웹 및 앱 활동」의 「사용 중지」 · 「활동 사용 중지 및 삭제」 | [도움말](https://support.google.com/accounts/answer/54068?hl=ko) | 2026-10-25 | — | settings-08 |

### 빈 화면

| 서비스 | 무엇 | 출처 | 확인 | 수준 | 쓴 자리 |
| --- | --- | --- | --- | --- | --- |
| 헬로우봇 | 「저장된 생일정보가 없어요.」 + 단추 「생일정보 추가」 · 「표시할 항목이 없어요」 · 「아직 작성된 리뷰가 없어요」 … | [문구표](https://hellobot.co/terms) | 2026-11-02 | B′ | 11-02 노트 §7 |
| 당근 SEED | Result Section 「Empty — 무엇을 해야 할지 알려주어 행동을 유도」 · 배경색 없이 가운데 · 단추 둘까지 | [Result Section](https://seed-design.io/components/result-section) | 2026-10-25 · 2026-10-26 | — | matching-09 · ADR 0109 |
| 토스 TDS | `Result` 는 판 없이 작은 단추(38px) | 링크 없음 | 2026-10-26 | — | ADR 0109 |

### 실패 · 재시도

| 서비스 | 무엇 | 출처 | 확인 | 수준 | 쓴 자리 |
| --- | --- | --- | --- | --- | --- |
| 헬로우봇 | 「일시적인 문제가 발생했어요 / 잠시 후 다시 시도하거나 …」 · 「네트워크 상태를 확인해주세요」 · 단추 「다시 시도하기」 | [문구표](https://hellobot.co/terms) | 2026-11-02 | B′ | 11-02 노트 §7 · matching-17 |
| 헬로우봇 | 「페이지를 불러올 수 없습니다」 · 「이전 메시지를 불러오지 못했습니다.」 · 「없는 상품이에요. …다시 불러 옵니다」 | [문구표](https://hellobot.co/terms) | 2026-11-02 | B′ | 11-02 노트 §7 |
| 토스 | 좋은 에러 메시지 6원칙(2022-09-21) — 다음 단계로 이끌기 · 상황 · 이유 · 해결책 · 「~할 수 있어요」 | [toss.tech](https://toss.tech/article/how-to-write-error-message) | 2026-11-02 | A′ · C | 11-02 노트 §7 · matching-17 · matching-19 |
| 토스 | 반복 상황을 카테고리별 템플릿과 문구 라이브러리로 규격화 | [toss.tech](https://toss.tech/article/introducing-toss-error-message-system) | 2026-11-02 | C | 11-02 노트 §7 |
| 토스 TDS | 토스트 예 「결제에 실패했어요」 · 「새로운 알림이 있어요」 · 「…문의사항이 있으시면 … 연락해 주세요.」 | [llms-full.txt](https://tossmini-docs.toss.im/tds-mobile/llms-full.txt) | 2026-10-26 | — | matching-09 · all-06 |
| 카카오톡 | 채팅 보내기 — 「실패했을 때 그 메시지에 다시 보내기 혹은 X」(운영자 말) | 링크 없음 | 2026-10-11 | — | 대장 37 |

### 입력 오류 · 폼

| 서비스 | 무엇 | 출처 | 확인 | 수준 | 쓴 자리 |
| --- | --- | --- | --- | --- | --- |
| 헬로우봇 | 입력 칸 「생년월일 (양력)」 · 「태어난 시간 모름」 · 「관계」 … · 「시작과 동시에 … 이용약관에 동의하게 됩니다.」 | [문구표](https://hellobot.co/terms) | 2026-11-02 | B′ | 11-02 노트 §1 |
| 네이버 · 점신 | 393px — 네이버 「오늘의 운세」 밑줄 칸 · 한 줄 드롭다운 셋, 점신 한 화면에 한 질문 · 회색 알약(54px) | 링크 없음 | 2026-10-08 | — | ADR 0132 |
| 포스텔러 | 만세력 프로필 입력 「태어난 도시를 모르시는 경우 ‘서울특별시’ 혹은 태어난 국가의 수도를 입력해주세요」 | [입력 화면](https://pro.forceteller.com/profile/edit) | 2026-11-12 | — | all-20 |
| 원광만세력 | 출생지 기본값 「대한민국(-26분)」(조율자 조사) | 링크 없음 | 2026-11-12 | — | all-20 |
| 잡코리아 · 알바천국 | 두 글자 약칭 「서울 · 경기 · 인천 · 대전 · 세종 · …」 · 2026-07-01 통합 뒤 「전남광주」 | [잡코리아](https://www.jobkorea.co.kr/recruit/joblist?menucode=local) · [알바천국](https://www.alba.co.kr/job/area/MainLocal.asp) | 2026-11-12 | — | all-20 |
| 구글 설문지 (해외) | 응답 화면의 비운 필수 질문 아래 「필수 질문입니다.」 | 링크 없음 | 링크 확인 전 · 2026-11-14 | — | all-22 |
| 카카오 계정 | 폼 `.info_tf` — 오류는 칸 아래 8px · 왼쪽 · 칸 테가 붉음 | [로그인 CSS](https://accounts.kakao.com/login/) | 2026-11-14 | — | ADR 0252 |
| 당근 SEED | Field 「Footer 좌측에는 Helper Text와 Error Message가 위치」 · 오른쪽은 글자 수 세기 | [field.txt](https://seed-design.io/llms/components/field.txt) | 2026-11-14 | — | ADR 0252 |
| 토스 TDS | TextField `help` 「텍스트 필드의 아래쪽 도움말」 + `hasError` | [llm.txt](https://tossmini-docs.toss.im/tds-mobile/components/TextField/text-field/llm.txt) | 2026-11-14 | — | ADR 0252 |
| 네이버 · 카카오 | 로그인처럼 칸을 가를 수 없는 오류는 단추 근처에 모아 쓴다 | 링크 없음 | 2026-11-14 | — | ADR 0252 |

### 로딩 · 진행 중 · 완료 안내

| 서비스 | 무엇 | 출처 | 확인 | 수준 | 쓴 자리 |
| --- | --- | --- | --- | --- | --- |
| 토스 | UX 라이팅 원칙(해요체 · 능동형) — 완료 안내는 성공한 뒤의 해요체 한 줄 | 링크 없음 | 2026-10-10 | — | 대장 01 |

### 설정 · 계정 · 탈퇴 · 고객센터 · 약관 메뉴

| 서비스 | 무엇 | 출처 | 확인 | 수준 | 쓴 자리 |
| --- | --- | --- | --- | --- | --- |
| 헬로우봇 | 「더보기」 · 「자주 묻는 질문」 · 「결제문의」 … · 탈퇴 「왜 떠나시나요?」 · 「떠나기를 누르면 …삭제됩니다」 | [문구표](https://hellobot.co/terms) | 2026-11-02 | B′ | 11-02 노트 §8 · §9 |
| 점신 | 「서비스, 장애 관련 문의는 점신 앱 메뉴에서 ‘1:1문의’를 이용하세요.」 | [App Store](https://apps.apple.com/kr/app/id960571015) | 2026-11-02 | B | 11-02 노트 §8 |
| 토스 | 「'전체' → 오른쪽 상단 '설정(톱니바퀴모양)' → 하단의 '탈퇴하기'」 · 「고객센터」 · 메일 등 365일 24시간 | [FAQ](https://support.toss.im/faq/218?from=12&page=1) · [FAQ](https://support.toss.im/faq/218) · [App Store](https://apps.apple.com/kr/app/id839333328) | 2026-11-02 · 2026-10-26 | C · B(11-02 노트) | 11-02 노트 §8 · settings-09 · settings-14 · ADR 0109 |
| 토스 | FAQ 「탈퇴하시기 전 아래 내용을 꼭 확인해주세요 … 금융거래정보는 관련 법에 따라 5년간 보관됩니다」 | [FAQ](https://support.toss.im/faq/218) | 2026-10-26 | — | settings-11 |
| 토스 | 「설정」 제목 아래 설명 줄 없음 · 두 줄 줄 「보안 / 비밀번호 · 생체인증」 | [블로그](https://funissu.com/?p=12937) | 2026-10-26 | — | settings-09 |
| 토스 | 「전체 탭 > 설정 > 약관 및 개인정보 활용 동의」 — 설정 안에 약관 줄 | [토스피드](https://toss.im/tossfeed/article/toss-security-faq10) | 2026-11-02 | — | settings-14 |
| 토스 · 카카오톡 · 당근 | 화면 제목 「설정」 | 링크 없음 | 2026-10-26 | — | all-05 |
| 토스 · 당근 · 카카오톡 | 탈퇴하기는 설정 맨 아래(토스 · 당근) · 줄 사이 선 없음(토스) · 무리 이름은 흰 면 안 작은 회색 글자(카카오톡) | 링크 없음 | 2026-10-26 | — | ADR 0109 |
| 카카오톡 | 「설정」 맨 위 사진 · 이름 · 계정 이메일 · 무리 이름은 명사 하나 · 「친구 추천 허용」 아래 설명 한 줄 | [블로그](https://foxcg.com/kakaotalk-privacy-settings/) | 2026-10-26 | — | settings-09 · ADR 0109 |
| 당근 | 「나의 당근 → 설정 → 탈퇴하기」 · 「≡ 전체」 · 고객센터 무리 이름 · 정지가 새 계정에 이어진다(1차 원문 못 찾음) | [블로그](https://jab-guyver.co.kr/3195) | 2026-10-26 · 2026-11-02 · 2026-11-03 | — | settings-09 · settings-14 · ADR 0218 |
| 카카오톡 | 「카카오톡 탈퇴하기」 창 「…즉시 삭제되며, 복구할 수 없습니다. 단, 카카오계정은 탈퇴되지 않고 유지됩니다.」 | [블로그](https://yellowit.co.kr/it-review/%EC%B9%B4%EC%B9%B4%EC%98%A4%ED%86%A1-%ED%83%88%ED%87%B4-%ED%9B%84-%EC%9E%AC%EA%B0%80%EC%9E%85-%EC%A3%BC%EC%9D%98%EC%82%AC%ED%95%AD-2%EA%B0%80%EC%A7%80/) | 2026-10-26 | — | settings-11 |
| 당근 | 탈퇴 안내 「삭제되면 복구 안 되는 것」 | [블로그](https://yellowit.co.kr/it-review/%eb%8b%b9%ea%b7%bc%eb%a7%88%ec%bc%93-%ed%83%88%ed%87%b4-%ed%9b%84-%ec%9e%ac%ea%b0%80%ec%9e%85-7%ec%9d%bc%ec%9d%b4%eb%82%b4-%eb%8f%99%ec%9d%bc%ed%95%9c-%ed%95%b8%eb%93%9c%ed%8f%b0%eb%b2%88%ed%98%b8/) | 2026-10-26 | — | settings-11 |
| 정오의 데이트 | 탈퇴는 로그인 뒤 상단 내정보 · 하단 「문의보내기/신고하기」 · 메일과 전화 | [FAQ](https://noondate.com/v2/support/faq) | 2026-11-02 | A′ | 11-02 노트 §8 · settings-14 |
| 정오의 데이트 | 탈퇴 기능 · 메일, 탈퇴 회원 CI · DI 7일 「재가입 제한 및 … 방지」 · 로그인은 페북 · 애플 · 카카오 | [처리방침](https://noondate.com/privacy) | 2026-11-02 | — | ADR 0218 · ADR 0219 |
| 미러 | 웹 바닥글 — 이용요금 · 이용약관 · 개인정보처리방침 · 아동 안전 표준 · 환불정책 · 문의하기 · 계정·데이터 삭제 | [웹](https://mirror-apps.com) | 2026-11-02 | A | 11-02 노트 §8 · first-01 · settings-14 |
| 미러 | 약관 「언제든지 … 회원 탈퇴」(제12조⑥), 정지 예외 없음 · 식별값 · 제재 사유 · 일시 1년 | [약관](https://mirror-apps.com/terms) | 2026-11-02 | — | ADR 0218 |
| 맞나만나 | 웹 바닥글 「문의·도움말」 · 「이용약관」, 앱 「탈퇴하기」(제18조), 문의는 카카오톡 채널 · 메일(제22조) | [웹](https://matnamana.com) · [약관](https://matnamana.com/terms) | 2026-11-02 | A′ | 11-02 노트 §8 · settings-14 |
| 맞나만나 | 「언제든 … 바로 탈퇴」, 앱을 못 쓰면 메일(제18조①) · 위반 해지자 재가입 거절(제5조⑤) | [약관](https://matnamana.com/terms) | 2026-11-02 | — | ADR 0218 |
| 글램 | 앱 안 삭제(제17조) · 반복 위반자 「동일한 신상정보로 재가입」 제한, 위반 기록 · CI · DI 6개월 | [처리방침](https://privacy.glam.am/privacy_policy) | 2026-11-02 | — | ADR 0218 |
| 위피 | 「언제라도 계정을 삭제」 · 부정 이용 기록 1년 | [처리방침](https://terms.wippy.io/privacy/) | 2026-11-02 | — | ADR 0218 |
| 슈퍼루키 | 「방법 1: 직접 탈퇴(로그인 가능한 경우)」 · 「삭제되는 개인정보」 · 「대금결제 및 재화 공급 기록: 5년」 … | [계정 삭제](https://superookie.com/account-deletion) | 2026-11-08 | — | public-16 |
| 카카오 · 토스 | 약관을 웹 페이지로 둔다(앱 내부 구현은 확인 못 함) | [카카오](https://www.kakao.com/policy/terms?type=a&lang=ko) · [토스](https://toss.im/agreement/privacy/20190109) | 2026-11-07 | — | ADR 0172 · ADR 0237 |
| 헬로우봇 | 처리방침 「회원 탈퇴 시까지」 꼴 · 「시행일 7일 이전에 웹 사이트에 공지합니다. 다만, … 30일 이전에 공지합니다.」 | [처리방침](https://neuralarcade.notion.site/3335d6e85ee880029e36cad5c1da5fc7) | 2026-11-07 | — | public-13 |
| Google Workspace (해외) | 선택 동의 이름 · 설명의 근거 「설문조사 및 사용자 환경 연구에 참여하도록 허용」 | [도움말](https://knowledge.workspace.google.com/admin/generative-ai/workspace-with-gemini/let-users-participate-in-surveys-and-user-experience-studies?hl=ko) | 2026-11-05 | — | public-09 · public-11 |

### 알림 · 권한 안내

| 서비스 | 무엇 | 출처 | 확인 | 수준 | 쓴 자리 |
| --- | --- | --- | --- | --- | --- |
| 포스텔러 | 필수 접근 권한 「없음」 · 프로필 사진이 없다(사진 권한은 이미지 저장용) | [App Store](https://apps.apple.com/kr/app/id1262949138) | 2026-11-02 · 2026-10-23 | B(11-02 노트) | 11-02 노트 §1 · G-120 기록 |
| 글램 · 아만다 · 토스 | 선택 권한은 안 줘도 이용 가능하다고 밝힘(첫 실행에 묻는지는 모름) | [글램](https://apps.apple.com/kr/app/id1058232900) · [아만다](https://apps.apple.com/kr/app/id906675357) · [토스](https://apps.apple.com/kr/app/id839333328) | 2026-11-02 | B | 11-02 노트 §1 |
| 미리 소개팅 | 접근 권한 안내 「채팅 및 개인 프로필 사진 등록을 할 때 이용합니다.」 | [App Store](https://apps.apple.com/app/id1483004283) | 2026-10-30 | — | settings-13 |
| KT 샵 | 「재입고 알림신청」 창 | [재입고 알림](https://shop.kt.com/smart/restockNoticePopView.do?prodNo=AC00010409&sntyNo=&vndrNo=ACC7850&prodTypeCd=AC) | 링크 확인 전 · 2026-11-05 | — | home-11 · ADR 0223 |
| Shopify 앱 (해외) | 한국어 페이지의 「"알림 받기" 버튼」 | [앱 페이지](https://apps.shopify.com/back-in-stock-notifications?locale=ko) | 링크 확인 전 · 2026-11-05 | — | home-11 |
| Android 고객센터 (해외) | 「Android에서 알림 제어」 — 앱별 알림 켜고 끄기 · 걸음 「기기의 설정 앱을 엽니다.」 | [고객센터](https://support.google.com/android/answer/9079661?hl=ko) | 2026-11-07 | — | settings-16 |

### 사진 · 프로필

| 서비스 | 무엇 | 출처 | 확인 | 수준 | 쓴 자리 |
| --- | --- | --- | --- | --- | --- |
| 다모앙 | 운영 공지 「프로필 사진 저장 방식 변경」(2025-10, 검색 요약 — 본문 403) | [공지](https://damoang.net/free/5084412) | 2026-10-23 | — | settings-05 · G-120 기록 |
| 글램 | 가입의 사진 화면 제목 「프로필 사진을 올려주세요」 | [블로그](https://m.blog.naver.com/miiiiii_j/223886463156) | 2026-10-24 | — | settings-07 |
| 인스타그램 (해외) | 「피드의 게시물을 길게 누른 다음 … 원하는 위치로 이동해 순서를 변경할 수 있습니다」 | [블로그](https://extrememanual.net/56607) | 2026-10-24 | — | settings-07 |
| 카카오톡 | 내 프로필 사진 보기 — 머리 가운데 「1 / 2」 · 왼쪽 위 × | [블로그](https://dolphintravel.tistory.com/entry/카톡-프로필-사진-삭제하는-방법) | 2026-10-24 | — | settings-07 |
| 카카오톡 | 내 프로필의 「프로필 편집」(당근 「프로필 수정」 · 아만다 「프로필 수정하기」) | [블로그](https://m.blog.naver.com/softman_777/223147254073) | 2026-10-24 | — | matching-08 · home-12 |
| 카카오톡 | 「프로필 편집」에서 이름 · 상태메시지 아래 「생일」(양력 · 음력) | [블로그](https://m.blog.naver.com/m84vlog/224322711492) · [블로그](https://itread.kr/blog/20034-kakaotalk-birthday-settings-display-hide-change-guide/) | 2026-10-26 | — | home-02 |
| Indeed (해외) | 한국 도움말 — 사진 업로드는 선택 | [도움말](https://kr.indeed.com/help/job-seekers/articles/27517857907853-uploading-a-profile-photo) | 2026-10-23 | — | G-120 기록 |

### 인연 · 채팅 · 신고 · 차단

| 서비스 | 무엇 | 출처 | 확인 | 수준 | 쓴 자리 |
| --- | --- | --- | --- | --- | --- |
| 맞나만나 | 「누가 무엇을 보나요」 표(줄마다 공개 범위와 시점) · 「결정은 언제나 내가 해요」 · 「사진·실명·직장 이름은 없어요」 | [웹](https://matnamana.com) | 2026-11-02 | A | 11-02 노트 §5 |
| 맞나만나 | 예시 화면 단추 「질문하고 결정하기」 · 「질문 없이 수락하기」 · 「이번엔 괜찮아요」 · 거절은 「…이유는 알리지 않아요.」 | [웹](https://matnamana.com) | 2026-11-02 | A | 11-02 노트 §6 · matching-15 |
| 미러 | 「어느 한쪽이라도 원치 않으면 연결되지 않으니 부담 갖지 않아도 돼요.」 · 리포트는 두 사람만 봄 | [App Store](https://apps.apple.com/kr/app/id6790402423) · [웹](https://mirror-apps.com) | 2026-11-02 | A′ · A | 11-02 노트 §5 · matching-15 |
| 미러 | 두 사람 모두 「더 알아볼래요」를 눌러야 「실제 대화방이 열려요」 · 「일부 프리미엄 기능에는 인앱 재화가 사용돼요」 | [웹](https://mirror-apps.com) | 2026-11-02 · 2026-11-19 | A | 11-02 노트 §6 · G-130 기록 |
| 미러 | 「만 19세 이상 성인만 이용할 수 있으며, 가입 시 휴대전화 본인확인으로 성인 여부를 확인합니다」 | [웹](https://mirror-apps.com/) | 2026-11-02 | — | matching-15 · matching-16 |
| 미리 소개팅 | 「…본인 사진 등록이 필수」(개발사 답변) · PASS + 셀카 · 「내 연락처에 있는 사람을 … 서로 노출되지 않아요!」 | [App Store](https://apps.apple.com/kr/app/id1483004283) | 2026-11-02 | A′ · B | 11-02 노트 §5 |
| 미리 소개팅 | 「…무료로 소개되는 프로필 카드」 · 「매칭되어도 제대로 대화가 안되면 환불」 · 「대화가 일찍 끊겨도 100% 환불」 | [App Store](https://apps.apple.com/kr/app/id1483004283) | 2026-11-02 · 2026-11-19 | B | 11-02 노트 §6 · matching-15 · G-130 기록 |
| 윌유 | 「60개 이상의 질문」 · 「스토리 카드」 · 「평균 1일 이내 검토」 · 「매일 4번, 당신과 가장 어울릴 상대를 추천」 | [App Store](https://apps.apple.com/kr/app/id1644080758) | 2026-11-02 | B | 11-02 노트 §5 · §6 |
| 아만다 | 「아만다는 누구나 바로 만날 수 있는 곳이 아닙니다」 · 심사 「3점컷」 · 「약속을 잡고, 연락처를 교환하고, 공식 만남」 | [App Store](https://apps.apple.com/kr/app/id906675357) | 2026-11-02 | B | 11-02 노트 §5 · §6 |
| 아만다 | 신고 「신고가 접수되면 빠르게 확인하고 조치」 · 인앱 「리본」 · 후기 「서로 선택하면 리본쓰고 대화」 | [App Store](https://apps.apple.com/kr/app/id906675357) | 2026-11-02 | A′(후기는 이용자 말) | G-130 기록 |
| 글램 | 「가입 심사: 검증된 상대만 소개」 · 「무제한 소개팅」 · 「관심사가 맞는 인연이 먼저 대화를 걸어와요.」 · 「매일 추천」 | [App Store](https://apps.apple.com/kr/app/id1058232900) | 2026-11-02 · 2026-11-19 | B | 11-02 노트 §5 · §6 · G-130 기록 |
| 글램 | 「…대화 메시지를 최대 180일(약 6개월)간 보관」(제20조⑦) · 이용 신청(제4조) · 신고 후속 조치(제21조②) | [약관](https://privacy.glam.am/terms_of_service) | 2026-11-02 | A′ | 11-02 노트 §5 · §6 · G-130 기록 |
| 정오의 데이트 | 「…회원가입을 승인해드립니다.」(대기 시간 없음) · 「…대화창 나가기를 하게 되면 복구 및 재연결은 어렵습니다.」 | [FAQ](https://noondate.com/v2/support/faq) | 2026-11-02 | A′ | 11-02 노트 §5 · §6 · G-130 기록 |
| 위피 | 외부 메신저 · 송금 유도 피해 후기에 개발사가 「신고하기」 · 안전 가이드 · 메일로 안내 | [App Store](https://apps.apple.com/kr/app/id1261209014) | 2026-11-02 | A′ | 11-02 노트 §6 |
| 위피(일본판) | 매칭까지 무료, 채팅 등은 유료 플랜(한국판과 같은지 모름) | [App Store(일본)](https://apps.apple.com/jp/app/id6478654705) | 2026-11-02 | C | G-130 기록 |
| 당근 | 받은 말풍선을 길게 눌러 메시지별 신고(2020-12-11 기사) | [인사이트](https://www.insight.co.kr/news/316059) | 2026-11-02 | D | G-130 기록 |
| Hinge (해외) | 내용이 삭제되면 고쳐야 다시 피드에 나온다는 안내 | [도움말](https://help.hinge.co/hc/en-us/articles/43018068800531-What-Happens-When-Content-is-Removed-From-My-Profile) | 2026-11-02 | C | 11-02 노트 §5 |
| Hinge (해외) | Most Compatible 제안은 24시간 뒤 만료(일반 매칭 만료 규정은 아님) | [도움말](https://help.hinge.co/hc/en-us/articles/360011233073-What-is-Most-Compatible) | 2026-11-02 | C | 11-02 노트 §6 |
| 힌지 (해외) | 프로필 상세 머리의 이름 · 「⋯」 · 닫기가 한 줄 | [Google Play](https://play.google.com/store/apps/details?id=co.hinge.app&hl=ko&gl=KR) | 2026-10-24 | — | matching-07 · ADR 0155 |
| 아만다 | 카드의 이름 · 칩 아래 구분선 뒤 소개 글 | [Google Play](https://play.google.com/store/apps/details?id=com.dorsia.amanda&hl=ko&gl=KR) | 2026-10-24 | — | matching-07 |
| 스카이피플 · 아만다 · 글램 · 정오의데이트 · 케밋 · 힌지(해외) | 프로필 상세 배치(공개 스토어 스크린샷) — 이름은 시트 머리, 사진 세로 4:5 | 링크 없음 | 2026-10-24 | — | matching-07 · ADR 0155 |
| 힌지 · 범블 · 헬로우톡 (해외) | 소개는 접지 않고 끝까지, 시트 안에서 내려 읽는다 | 링크 없음 | 2026-10-27 | — | ADR 0155 |
| 카카오톡 | 친구 탭 맨 위 「내 프로필」 · 채팅방 오른쪽 위 ☰(채팅방 서랍) 「대화상대」 맨 위의 「나」 | [블로그](https://forbes.tistory.com/827) | 2026-10-24 | — | matching-08 · ADR 0158 |
| 카카오톡 | 머리 · 말풍선 곁 사진을 누르면 그 사람 프로필이 먼저 · 손가락 기기에서 Enter 는 줄바꿈 | 링크 없음 | 2026-10-11 | — | ADR 0155 |
| 토스 | 송금 확인 「받는 분에게 표시 · 출금 계좌」 — 칸 이름이 방향을 말한다 | [블로그](https://funissu.com/toss-sender-name-change/) | 2026-10-26 | — | matching-10 |
| 틴더 (해외) | 「별자리 모드」의 이름 아래 「성향의 조합」 구역 | [App Store](https://apps.apple.com/kr/app/id547702041) | 2026-10-27 | — | matching-14 |
| 라프텔 · 베이브챗 | 「성인 인증」 · 「성인/본인인증」 안내(같은 단추 글자는 못 봄) | [라프텔](https://help.laftel.net/hc/ko/articles/10081057394703-%EC%84%B1%EC%9D%B8-%EC%9D%B8%EC%A6%9D) · [베이브챗](https://docs.channel.io/babechat/ko/articles/%EC%84%B1%EC%9D%B8%EB%B3%B8%EC%9D%B8%EC%9D%B8%EC%A6%9D-144b82f5) | 2026-11-02 | — | matching-16 |
| 리메리 · 크리스천데이트 | 스토어 소개에서 인증 · 심사 조건을 먼저 밝힘(같은 문장은 못 찾음) | [리메리](https://apps.apple.com/mw/app/%EB%A6%AC%EB%A9%94%EB%A6%AC-%EB%8F%8C%EC%8B%B1%EC%9D%84-%EC%9C%84%ED%95%9C-%EA%B2%BD%EC%A0%9C%EB%A0%A5-%EC%9D%B8%EC%A6%9D-%EC%86%8C%EA%B0%9C%ED%8C%85/id6736382595) · [크리스천데이트](https://mwm.ai/apps/1-1/577004927) | 2026-11-02 | — | public-03 |
| Instagram (해외) | 메시지 요청 — 상대가 답하기 전에는 첫 말 하나(영문 보도, 한국어 공식 안내 못 찾음) | [Neowin](https://www.neowin.net/news/instagram-is-changing-how-unknown-users-can-or-cant-text-you/) | 2026-11-02 | — | matching-19 |
| OpenAI (해외) | 한국 이용자 부록 — 국외 보관 · 이전을 적는 꼴(AI 전송 고지의 가장 가까운 것) | [부록](https://openai.com/ko/policies/kr-privacy-policy-addendum) | 2026-11-02 | — | matching-20 |
| 토스플레이스 | 토스오더의 「베타 기간」 안내 꼴 | [토스플레이스](https://tossplace.com/story/tossorder-event) | 2026-11-04 | — | matching-22 |
| 틴더 (해외) | 한국어판 『내 계정 숨기기』 — 『새 사람에게 안 보임 · 기존 대화 유지』 | [안전 센터](https://policies.tinder.com/safety-center/tools/privacy/intl/ko) | 2026-11-08 | — | matching-23 · settings-20 |
| Tinder · Hinge · Bumble (해외) | 언매치(연결만 끊기)를 차단과 따로 둔다 — Bumble 은 링크 없음 | [Tinder](https://www.help.tinder.com/hc/en-us/articles/115003360106-Unmatching-someone) · [Hinge](https://help.hinge.co/hc/en-us/articles/36311673303571-Unmatching) | 날짜 없음(2026-10-11 라운드) | — | G-102 기록 |
| 위피 · 틴더(해외) | 추천은 계속 채워진다 | 링크 없음 | 2026-09-27 | — | ADR 0115 |
| Tinder (해외) | 매치 취소 · 차단과 같은 결 — 거절 · 만료 · 무효 · 차단을 같은 화면 모양으로 | 링크 없음 | 2026-09-28 | — | ADR 0120 |
| 인스타그램 (해외) | 활동 상태 옵트아웃(끄면 상대 것도 못 본다) — 이 결정에 없음 | 링크 없음 | 날짜 없음 | — | ADR 0092 |

### 사주 · 궁합 결과 · 풀이 화면

| 서비스 | 무엇 | 출처 | 확인 | 수준 | 쓴 자리 |
| --- | --- | --- | --- | --- | --- |
| 포스텔러 | 「오늘의 운세 점수」 · 「…하루 총운부터 개운법까지」 · 「주제 별 상세 풀이부터 월운 흐름까지」 · 「200쪽 이상」 | [App Store](https://apps.apple.com/kr/app/id1262949138) | 2026-11-02 · 2026-11-12 | B | 11-02 노트 §2 · first-07 |
| 점신 | 「오늘의 운세부터 시간대별 운세 흐름, 애정·금전·건강운까지 한눈에」 · 「첫 상담 3분 무료 혜택부터 …」 | [App Store](https://apps.apple.com/kr/app/id960571015) | 2026-11-02 · 2026-11-12 | B(11-02 노트) | 11-02 노트 §2 · first-02 · first-07 |
| 포스텔러 · 점신 | 포스텔러는 카드 피드, 점신은 종합 진단 대시보드가 첫 화면 · 점신은 오각형 그래프 · 게이지로 점수라는 글 | [brunch 2026-07-09](https://brunch.co.kr/@uibowl/403) | 2026-11-02 | D | 11-02 노트 §1 · §2 |
| 정통사주 | 「사주표 상세보기」에 대운 · 세운 · 합 · 충 · 12운성 · 12신살 · 후기 「결과 문장이 계속 이어져있어서 …」 | [App Store](https://apps.apple.com/kr/app/id1178530910) | 2026-11-02 | A′ | 11-02 노트 §2 · first-02 |
| 미리 소개팅 | 「내 사주 풀이」 「타고난 기질, 연애성향」 · 「맘에 드는 친구와의 궁합점수」 · 매력리포트(매력살 분석과 TIP) | [App Store](https://apps.apple.com/kr/app/id1483004283) | 2026-11-02 | B | 11-02 노트 §2 |
| 헬로우봇 | 「사주를 처음 접하는 사람도 이해하기 쉽게 풀이」 · 「200개 이상 사주, 타로 평생 무료 제공」 | [App Store](https://apps.apple.com/kr/app/id1294957719) | 2026-11-02 | B | 11-02 노트 §2 |
| 점신 | 용어 설명 「세운(世運): 해마다 바뀌는 간지가 …」 · 「지지 속에 숨은 천간의 힘」 · 궁위 표 「일주 — 나 자신 …」 | [웹](https://www.jeomsin.co.kr/) | 2026-11-07 | — | first-05 · compat-01 |
| Apple 지원 (해외) | 문서 끝 「도움이 되었습니까?」 한 줄 — 접힌 풀이 의견의 가장 가까운 사례 | [지원](https://support.apple.com/ko-kr/105071) | 2026-10-26 | — | home-08 |

### 탭 · 메뉴 · 배치 · 디자인 체계 (SEED · TDS · 토큰 · 부품)

| 서비스 | 무엇 | 출처 | 확인 | 수준 | 쓴 자리 |
| --- | --- | --- | --- | --- | --- |
| 카카오톡 | 등록 설명에 친구탭 · 지금탭, 2025-09 개편 보도에 「다섯 개 탭」 | [App Store](https://apps.apple.com/kr/app/id362057947) · [뉴시스](https://mobile.newsis.com/view/NISX20250923_0003339391) | 2026-11-02 | B · D | 11-02 노트 §9 |
| 토스 | 도움말의 하단 「홈」 · 「전체」 · 오른쪽 아래 「증권」, 혜택 탭 | [토스 FAQ](https://toss.im/faq) | 2026-11-02 | C | 11-02 노트 §9 |
| 미러 | 「소개팅 탭」(버전 노트) · 「홈 · 오늘의 대화」 · 「마이」 | [App Store](https://apps.apple.com/kr/app/id6790402423) · [웹](https://mirror-apps.com) | 2026-11-02 | A′ | 11-02 노트 §9 |
| 맞나만나 | CTA 곁 「앱 설치 없이 웹에서도 · 주선 자리 5명 무료」 · 세 단계 · 「누가 무엇을 보는지 먼저 알려드릴게요」 | [웹](https://matnamana.com) | 2026-11-02 | A | 11-02 노트 §1 · first-01 |
| 카카오톡 | 친구 탭 맨 위 「내 프로필」 · 친구 줄은 이름 아래 상태 메시지 · 줄을 누르면 프로필 · 테두리 단추 「선물하기」 | [App Store](https://apps.apple.com/kr/app/id362057947) | 2026-10-26 | — | home-01 · home-02 · home-04 · home-05 · home-06 |
| 카카오톡 | 선물하기 「선물함 → 받은 선물」 | [블로그](https://cha4se.tistory.com/entry/카카오톡-받은-선물-확인하는-방법) · [가이드](https://senior-guide.kr/guides/kakao-gift-box) | 2026-10-26 | — | home-01 |
| 카카오톡 | 「친구 추가」 줄 | [블로그](https://m.blog.naver.com/kimdae025/224282546307) | 2026-10-26 | — | home-01 |
| Apple 지원 (해외) | 「최근 구입 옆에 있는 '모두 보기'를 클릭합니다」 — 구역 제목 옆 링크 | [지원](https://support.apple.com/ko-kr/118212) | 2026-10-26 | — | home-01 |
| 토스증권 · 뱅크샐러드 | 목록 오른쪽 값(굵은 값 위 · 작은 이름 아래) · 토스증권 홈 「해외주식 … 보기 >」 | [토스증권](https://apps.apple.com/kr/app/id839333328) · [뱅크샐러드](https://apps.apple.com/kr/app/id1195804784) | 2026-10-26 | — | home-01 · home-02 · home-05 |
| 당근 · 당근페이 | 매너온도 「36.5°C」 뒤 얼굴 그림 · 상세의 ← 는 화살표만 · 당근페이 「진행 중인 거래」 아래 「전체보기 ⌄」 | [App Store](https://apps.apple.com/kr/app/id1018769995) | 2026-10-26 | — | home-04 · home-05 |
| 당근 · 토스 | 한 화면을 고정 폭 가운데 — 당근 웹 목록 940px · 토스피드 글 본문 700px · 토스 고객센터 690px | 링크 없음 | 2026-10-10 | — | ADR 0161 |
| 당근 SEED | screenTitle 26/35 · r5 · r3 · `Switch` · `Article` 어절 줄바꿈 · ghost 단추 | 링크 없음 | 2026-10-24 · 2026-10-26 | — | ADR 0109 |
| 당근 SEED | Top Navigation — 스크롤 영역과 가르는 장치 없음 · 제목 18px 굵게 · 6px + 10px = 16px | 링크 없음 | 2026-10-25 · 2026-10-26 | — | ADR 0109 |
| 토스 TDS | 설정 목록 — `Border` 「구간을 나눈다면 `height16`」 · `padding24` · `ListHeader` | 링크 없음 | 2026-10-26 | — | ADR 0109 |
| 토스 TDS | Typography · `Top` 큰 제목은 본문 왼끝 · `TextButton` 밑줄 없이 굵기와 색 | 링크 없음 | 2026-10-24 · 2026-10-26 | — | ADR 0109 |
| 토스 TDS | `ListRow` 의 두 줄 글 — 아래 줄은 짧게 | [ListRow](https://tossmini-docs.toss.im/tds-mobile/components/ListRow/list-row-components/) | 2026-10-26 | — | settings-09 |
| 토스 TDS | 색 체계 개편 「하나의 소스를 바라보게」 · 토큰에서 플랫폼별 코드를 자동으로 짓는다 | [toss.tech](https://toss.tech/article/tds-color-system-update) | 2026-10-31 | — | ADR 0109 |
| 토스 | 자체 서체 하나로 앱 전체 통일 | 링크 없음 | 2026-10-28 | — | ADR 0109 |
| 토스 · 쿠팡 | 라이팅 원칙 — 해요체 기본의 참고 | 링크 없음 | 2026-09-29 | — | ADR 0135 |
| Material 3 · Android (해외) | 판 머리에 제목 없음 · Switch · Snackbar · Dialogs(나란히, 오른쪽 정렬) · Android 설정 패턴 | 링크 없음 | 2026-10-24 · 2026-10-25 | — | ADR 0109 · ADR 0205 |

### 한도 숫자 (사진 크기 · 용량 · 기간 · 글자 수)

| 서비스 | 무엇 | 출처 | 확인 | 수준 | 쓴 자리 |
| --- | --- | --- | --- | --- | --- |
| 글램 | 「AI 프로필 인증: … 페이스 인증으로 실제 얼굴을 검증」 · 「무보정 사진 인증」(v5.26.0) — 규격 공개 없음 | [App Store](https://apps.apple.com/kr/app/id1058232900) | 2026-10-23 | — | G-120 기록 |
| 글램(서울경제) | 「무보정 사진 인증」을 다룬 기사(2025-12-04), 공식 자료 아님 | [기사](https://m.sedaily.com/amparticle/14153655) | 2026-10-23 | — | G-120 기록 |
| 위피 | 「24시간 모니터링과 다양한 인증 제도」(개발사 답글) — 규격 공개 없음 | [App Store](https://apps.apple.com/kr/app/id1261209014) | 2026-10-23 | — | G-120 기록 |
| 스카이피플 | 카메라 권한 「프로필 사진을 직접 촬영해서 올릴 때」 · 음란 사진 금지 — 규격 공개 없음 | [App Store](https://apps.apple.com/kr/app/id1191259452) | 2026-10-23 | — | G-120 기록 |
| 정오의데이트 | 음란 사진 금지 · 도용은 신고로 처리(개발사 답글) — 규격 공개 없음 | [App Store](https://apps.apple.com/kr/app/id427242564) | 2026-10-23 | — | G-120 기록 |
| 너랑나랑 | 사진 권한 「갤러리에서 사진 선택 후 프로필·스토리 등에 업로드」 — 규격 공개 없음 | [App Store](https://apps.apple.com/kr/app/id551321773) | 2026-10-23 | — | G-120 기록 |
| 아만다 | 「아만다만의 기준에 따라 회원을 심사」 · 「직접 촬영하는 셀카 인증」 — 규격 공개 없음 | [App Store](https://apps.apple.com/kr/app/id906675357) | 2026-10-23 | — | G-120 기록 |
| 다이아매치 · 골드스푼 | 「프로필 심사」 · 「엄격한 심사」(가입 서류 심사) — 규격 공개 없음 | [다이아매치](https://apps.apple.com/kr/app/id1447077801) · [골드스푼](https://apps.apple.com/kr/app/id1332604123) | 2026-10-23 | — | G-120 기록 |
| 점신 | 카메라 「관상 서비스 이용을 위해」 — 프로필 사진이 아니다 | [App Store](https://apps.apple.com/kr/app/id960571015) | 2026-10-23 | — | G-120 기록 |
| Instagram (해외) | 가로 최대 1080px 로 올린다 · 320px 보다 좁으면 키운다 · 비율 1.91:1 ~ 4:5 는 원래 해상도 | [도움말](https://help.instagram.com/1631821640426723) | 링크 확인 전 · 2026-10-23 | — | G-120 기록 |
| Bumble (해외) | JPG · PNG, 128MB 까지, 이상적으로 1024×1024, 6장까지 | [도움말](https://support.bumble.com/hc/en-us/articles/28523708029341) | 링크 확인 전 · 2026-10-23 | — | G-120 기록 |
| Hinge (해외) | 4~6장(지역에 따라) · 얼굴이 보이는 사진 하나, px · 형식 · 용량은 공개 없음 | [도움말](https://help.hinge.co/hc/en-us/articles/360011053094) | 2026-10-23 | — | G-120 기록 |
| Tinder (해외) | 「The one where it's actually you」 등 사진 고르는 말, 규격 공개 없음 | [FAQ](https://tinder.com/faq) | 2026-10-23 | — | G-120 기록 |
| 카카오 · 당근 · 포스타입 · 리디 | 부정이용 · 구매 제한 기록 기간 — 탈퇴 뒤 최대 1년(카카오) ~ 5년(당근 · 포스타입), 리디 3년 | 링크 없음 | 2026-11-06 | — | ADR 0230 |
| YouTube 고객센터 (해외) | 「각 경고는 적용 시점부터 90일이 지나기 전에는 소멸되지 않습니다.」 | [고객센터](https://support.google.com/youtube/answer/2802032?hl=ko) | 2026-10-17 | — | ADR 0191 |

### 운영 화면의 낱말

| 서비스 | 무엇 | 출처 | 확인 | 수준 | 쓴 자리 |
| --- | --- | --- | --- | --- | --- |
| 카카오페이지 | 제9조① 「유상으로 구매한 이용권」 · 「이용권의 미사용분」 · 제9조의2 「캐시의 환불」 · 「무료로 지급받은 캐시」 | [약관](https://page.kakao.com/policy/terms-paid) | 2026-11-06 | — | ops-01 · all-09 |
| 포스타입 | 이용약관 「포인트 사용 시」 · 「…환불액에 상응하는 포인트가 회수됩니다」 · 「잔여 포인트 여부를 확인」 | [약관](https://www.postype.com/tos) | 2026-11-06 | — | ops-01 · all-09 |
| Play Console (해외) | 「전액 환불」 · 「부분 환불」 · 「총 주문 금액 이상의 금액을 …」 · 「환불할 비율(100% 미만) 또는 세전 금액」 | [도움말](https://support.google.com/googleplay/android-developer/answer/2741495?hl=ko) · [영문](https://support.google.com/googleplay/android-developer/answer/2741495) | 2026-11-06 | — | ops-01 · all-09 · ADR 0230 |
| Play Console (해외) | 「앱 버전을 생성, 준비 및 출시」 — 「판본」이 아니라 「버전」 | [도움말](https://support.google.com/googleplay/android-developer/answer/9859348?hl=ko) | 2026-11-06 | — | ops-01 |
| 네이버페이 | 부분취소 화면의 꼴 — 취소에 필요한 칸을 한 판에 | 링크 없음 | 2026-10-16 | — | ADR 0184 |

### 업데이트 · 앱 판본 화면

| 서비스 | 무엇 | 출처 | 확인 | 수준 | 쓴 자리 |
| --- | --- | --- | --- | --- | --- |
| 솜씨당 · 정육각 · 기가지니 | 「업데이트 알림」(솜씨당) · 「안정적인 사용을 위해 …」 + 「업데이트하기」 하나(정육각) · 「최신버전으로 …」(기가지니) | [디지털인사이트 2020-09-03](https://ditoday.com/?p=42284) | 2026-11-07 | — | public-14 · ADR 0237 |
| SK엔카 | 「안정적인 이용을 위해 최신앱으로 업데이트 후 이용해주세요.」 + 「업데이트」 하나 | [디지털인사이트 2020-09-03](https://ditoday.com/?p=42284) | 2026-11-07 | — | public-14 · ADR 0237 |
| 카카오톡 | v11.0.0 미만 지원 제외 — 서버가 최소 버전을 들고 낮으면 스토어 업데이트 뒤에 쓴다 | [세계일보](https://www.segye.com/newsView/20260315506779) | 2026-11-07 | — | ADR 0237 |
| 뱅크샐러드 | 최소 지원 버전 공지 | [도움말](https://help.banksalad.com/1224) | 2026-11-07 | — | ADR 0237 |
| Proton (해외) | 필수 업데이트 뒤에도 웹은 그대로 쓴다는 안내 | [도움말](https://proton.me/ko/support/update-required) | 2026-11-07 | — | public-15 |

### 플랫폼 규정 — 조건이지 사례가 아니다 (Apple · Google · 카카오 · 앱인토스 규정)

| 서비스 | 무엇 | 출처 | 확인 | 수준 | 쓴 자리 |
| --- | --- | --- | --- | --- | --- |
| 카카오 로그인 디자인 가이드 | 「카카오 로그인」 · `#FEE500` · 글자 85% · 모서리 12px · OS 기본 서체 · 심볼 없이 못 만든다 | [디자인 가이드](https://developers.kakao.com/docs/ko/kakaologin/design-guide) | 2026-11-05 · 2026-11-06 | — | public-07 · public-12 · settings-15 · ADR 0224 · ADR 0228 |
| 카카오싱크 디자인 가이드 | 표준 단추 「카카오로 시작하기」 | [디자인 가이드](https://developers.kakao.com/docs/ko/kakaosync/design-guide) | 2026-11-12 | — | first-08 |
| Google 브랜딩 안내 (해외) | 「…1px inside stroke #747775 …」 · G 「can't change the size or color」 | [브랜딩 안내](https://developers.google.com/identity/branding-guidelines) | 2026-11-05 | — | public-10 · ADR 0228 |
| Apple HIG (해외) | 「Adjust the corner radius …」 · 「Prefer the system font」 · 최소 높이 30pt | [HIG](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple) | 2026-11-05 | — | ADR 0228 |
| Apple HIG (해외) | Toggles · Alerts(설명은 「값이 있을 때만」, 둘이면 나란히 · 취소가 앞) · 서체 수를 줄여라 | 링크 없음 | 2026-10-24 · 2026-10-25 · 2026-10-28 | — | ADR 0109 · ADR 0205 |
| Apple App Review (해외) | 4.8 — 제3자 로그인이면 「이름 · 이메일만 받고 · 이메일을 가릴 수 있고 · 광고용 수집이 없는」 로그인도 함께 | [지침](https://developer.apple.com/app-store/review/guidelines/#login-services) | 2026-11-03 | — | ADR 0219 |
| Apple App Review (해외) | 5.1.1(v) — 계정을 만들 수 있으면 앱 안에서 계정 삭제를 시작할 수 있어야 | [지침](https://developer.apple.com/app-store/review/guidelines/#5.1.1) | 2026-11-03 | — | ADR 0218 |
| Apple App Review (해외) | 3.1.3(b) — 같은 묶음이 앱에서도 인앱결제로 팔릴 것 | [지침](https://developer.apple.com/app-store/review/guidelines/) | 2026-11-02 | — | ADR 0212 |
| Apple 개발자 안내 (해외) | 「Apps that support Sign in with Apple should use … revoke user tokens」 | [Offering account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/) | 2026-11-03 | — | ADR 0219 |
| Apple 개발자 안내 (해외) | 계정 삭제를 쉽게 찾게 하라(강제 업데이트 화면의 계정 관리 길의 가까운 근거) | [한국어 안내](https://developer.apple.com/kr/support/offering-account-deletion-in-your-app/) | 2026-11-07 | — | public-15 |
| Google Play (해외) | 계정 삭제 요건 — 앱 안의 길과 웹 링크, 웹 쪽은 앱 이름 · 요청 걸음 · 지우는 것과 남는 것 · 기간 | [계정 삭제 요건](https://support.google.com/googleplay/android-developer/answer/13327111) | 2026-11-03 · 2026-11-06 | — | ADR 0218 · public-16 |
| Google Play (해외) | 결제 정책 — 앱 안 디지털 상품에 Play 결제(2항, 3 · 8 · 9항의 예외 밖) | [결제 정책](https://support.google.com/googleplay/android-developer/answer/9858738?hl=ko) | 2026-11-02 | — | ADR 0212 |
| 앱인토스 | UX 가이드 — 진입 직후 전체를 가리는 광고성 바텀시트 불허(알림 동의 요청 포함) · 탭바는 필수가 아니고 2 ~ 5개 | [UX 가이드](https://developers-apps-in-toss.toss.im/landing-page/landing-page-en/design/consumer-ux-guide) | 2026-11-02 | A′ | 11-02 노트 §1 · §9 |
| 앱인토스 | UX 라이팅 — 해요체 · 능동형 · 긍정형, 사용 불가처럼 알려야 할 사실은 부정형 · 다이얼로그 왼쪽 단추 「닫기」 | [UX 라이팅](https://developers-apps-in-toss.toss.im/design/ux-writing.html) | 2026-11-02 | C | 11-02 노트 §7 |
| 카카오 운영정책 | 제4조 「청소년에게 금지되는 콘텐츠(… 만남주선 등)」 금지, 카카오 인증서 확인과 별도 검토로만 예외 | [운영정책](https://developers.kakao.com/terms/latest/ko/site-policies) | 2026-11-04 | — | ADR 0222 |
| 카카오 데브톡 답 | 사주 기능만인 지금은 카카오 로그인 가능 · 인연을 열 때 「미성년자 보호를 위해 성인 인증 기능을 적용」 | [데브톡](https://devtalk.kakao.com/t/topic/152589) | 2026-11-05 | — | ADR 0222 · ADR 0223 · ADR 0224 · G-135 기록 |
