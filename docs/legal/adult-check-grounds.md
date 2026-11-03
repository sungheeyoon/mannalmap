# 인연의 연령 확인 — 법 · 스토어 · 자체 정책의 근거 (#947)

> 법률 자문이 아니고 변호사 검토 전이다. 「적법」이라는 뜻이 아니다 — 요건과 사실만 두고 판정은 운영자 몫이다(ADR 0182 · 0209).
> 원문을 확인한 날은 모두 **2026-11-03**, 코드는 main `a93f2ddb` 에서 잰 것이다. 셋(법 · 스토어 · 자체 정책)은 따로 적는다 —
> 한쪽의 답이 다른 쪽의 답이 아니다.

## 먼저 표시할 둘

- **스토어 18+ 등급은 실제 나이 확인이 아니다.** 애플 연령 등급은 이용자가 아니라 앱에 붙는 표시이고(아래 2.3.6), 구글 Play 의
  「Restrict Minor Access」는 구글 계정의 나이와 구글 시스템의 판단으로 검색 · 설치 · 구매를 막는다. 이미 설치한 사람은 계속 쓴다(아래 원문).
  둘 다 앱 안에서 이 사람이 몇 살인지 확인하지 않는다.
- **사주용으로 직접 입력한 생년월일은 연령 자기신고이지 본인확인이 아니다.** 코드는 그 값으로 인연 자격을 재지 않는다 — 인연의
  조건은 성별 하나다(PRD §6.1 「나이는 없다」). **자기신고만으로 출시할 수 있는지는 「확인되지 않음」이다.**

## 우리 기능 — 코드에서 잰 것

| 물음 | 지금 | 잰 자리 |
| --- | --- | --- |
| 가입 | 구글 로그인 + 운영자가 준 테스트 코드. 휴대전화 · 실명 인증은 없다 | `app/auth/page.tsx:40` |
| 누가 누구를 보나 | 내 사주를 저장하면 후보 풀에 자동으로 든다(끌 수 있다). 조건은 성별 하나. 한 자리는 점수 상위 20% 컷 안에서 80%, 컷 아래에서 20% 무작위로 채운다 — 지인 목록이 아니다 | `supabase/migrations/20261107090000_the_deck_scores_each_shape_once_and_the_rooms_start_from_me.sql:121` · `:231` · PRD §6.1 |
| 카드에 나가는 것 | 닉네임 · 자기소개 · 사진(한 사람 여섯 장까지) · 예측 궁합 점수 · 활동 띠. 나이 · 지역 칸은 없다 | `supabase/migrations/20261203090000_a_photo_shows_the_spot_its_owner_chose.sql:285`(반환 칸) |
| 대화가 열리는 때 | 지금은 받은 사람이 궁합 요청을 수락한 뒤 두 사람의 1:1 방. 스위치를 켜면 수락 없이 열리고 답 전 첫 말 1건까지다 — 스위치 기본값은 꺼짐 | PRD §6.2 · §6.6 · `supabase/migrations/20270106090000_the_talk_opens_first_and_the_detail_waits_for_a_press.sql:14-23` |
| 대화의 형태 | 글만 — 음성 · 화상 없음 | `supabase/migrations/20270106090000_the_talk_opens_first_and_the_detail_waits_for_a_press.sql:1174`(`send_chat_message(p_match_id, p_body text, …)`) |
| 대화 저장 | 서버 표에 남는다. 닫힌 방은 90일 보존 뒤 크론이 지운다(크론은 운영 배포 전, G-132) | `supabase/migrations/20260927090000_the_matched_pair_talks_in_a_room.sql:174`(`chat_message`) · `:69`(`chat_retention` 90일) · `supabase/migrations/20270107100000_the_closed_rooms_words_go_by_a_daily_cron.sql:42` |
| 신고 | 사람 신고 · 메시지 신고, 메시지는 사본을 남긴다 | `supabase/migrations/20261017090000_the_held_report_still_counts_as_a_duplicate.sql:25` · `:106` · `supabase/migrations/20260927090000_the_matched_pair_talks_in_a_room.sql:234`(`chat_report_snapshot`) |
| 차단 | 있다. 되돌릴 수 없다 | `supabase/migrations/20270106090000_the_talk_opens_first_and_the_detail_waits_for_a_press.sql:2076` · PRD §6.5 |
| 위치 | 기기 위치를 쓰지 않는다 — 앱 의존성에 위치 패키지가 없다. 출생지는 태어난 시각을 보정하는 경도로만 쓰고 카드에 안 나간다 | `mobile/package.json`(`expo-location` 없음) · `src/lib/saju/timeCorrection/longitude.ts:33` |
| 성인 확인 | 스위치 기본값 꺼짐 — 꺼져 있으면 누구에게나 통과다. 업체 연동 없음 | `supabase/migrations/20270105090000_the_adult_check_stands_ready_behind_a_switch_that_is_off.sql:15-24` · `:41-52` · ADR 0214 「정한 것」 8 |
| 사주용 생년월일 | 이용자가 직접 입력한다 | `app/birth-form.tsx:127` |

## 1. 한국 법적 의무

### 원문

**청소년 보호법** [시행 2026. 10. 8.] [법률 제21537호, 2026. 4. 7., 일부개정] —
https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=0&chrClsCd=010202&efYd=20261008&lsiSeq=285397

- 제2조 1호 — 「“청소년”이란 19세 미만인 사람을 말한다. 다만, 19세가 되는 해의 1월 1일을 맞이한 사람은 제외한다.」
- 제2조 3호 — 「“청소년유해매체물”이란 다음 각 목의 어느 하나에 해당하는 것을 말한다. 가. 제7조제1항 본문 및 제11조에 따라
  청소년보호위원회가 청소년에게 유해한 것으로 결정하거나 확인하여 성평등가족부장관이 고시한 매체물 …」
- 제7조 ① — 「청소년보호위원회는 매체물이 청소년에게 유해한지를 심의하여 청소년에게 유해하다고 인정되는 매체물을
  청소년유해매체물로 결정하여야 한다. …」
- 제16조 ① — 「청소년유해매체물로서 대통령령으로 정하는 매체물을 판매ㆍ대여ㆍ배포하거나 시청ㆍ관람ㆍ이용하도록 제공하려는 자는
  그 상대방의 나이 및 본인 여부를 확인하여야 하고, 청소년에게 판매ㆍ대여ㆍ배포하거나 시청ㆍ관람ㆍ이용하도록 제공하여서는 아니 된다.」
  ④ — 「제1항에 따른 상대방의 나이 및 본인 여부의 확인방법, 그 밖에 청소년유해매체물의 판매 금지 등에 필요한 사항은 대통령령으로 정한다.」
- 제58조 1호(3년 이하 징역 또는 3천만원 이하 벌금) — 「영리를 목적으로 제16조제1항을 위반하여 청소년에게 청소년유해매체물을
  판매ㆍ대여ㆍ배포하거나 시청ㆍ관람ㆍ이용하도록 제공한 자」
- 참고 — 제2조 5호 가목 7)은 「불특정한 사람들 사이의 음성대화 또는 화상대화를 매개하는 것을 주된 목적으로 하는 영업」이다. 우리 대화는 글만이다(위 표).

**청소년 보호법 시행령** [시행 2026. 10. 8.] [대통령령 제36695호, 2026. 9. 22., 일부개정] — 국가법령정보센터 `lsiSeq=289973`

- 제16조 — 「법 제16조제1항에 따라 … 금지되는 청소년유해매체물은 법 제2조제2호가목부터 마목까지 및 사목부터 카목까지의 규정에 해당하는
  청소년유해매체물을 말한다.」(마목이 「전기통신사업법」에 따른 전기통신을 통한 부호ㆍ문언ㆍ음향 또는 영상정보다)
- 제17조 ① — 「… 다음 각 호의 어느 하나에 해당하는 수단이나 방법으로 그 상대방의 나이 및 본인 여부를 확인하여야 한다.
  1. 대면(對面)을 통한 신분증 확인이나 팩스 또는 우편으로 수신한 신분증 사본 확인 2. 「전자서명법」 제2조제6호에 따른 인증서(서명자의
  실지명의를 확인할 수 있는 것으로 한정한다) 3. 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 제23조의2제2항에 따른 주민등록번호를
  사용하지 아니하고 본인을 확인하는 방법 4. 「개인정보 보호법」 제24조의2제3항에 따라 주민등록번호를 사용하지 않고 회원으로 가입할 수 있는
  방법 5. 신용카드를 통한 인증 6. 휴대전화를 통한 인증. 이 경우 휴대전화를 통한 문자전송, 음성 자동응답 등의 방법을 추가하여 나이 및
  본인 여부를 확인하여야 한다. 7. 그 밖에 제1호부터 제6호까지의 규정에 따른 수단이나 방법과 유사한 것으로서 성평등가족부장관이 정하여
  고시하는 것」
- 제17조 ② — 회원으로 가입한 상대방을 제1항으로 확인했으면 「그 확인 후 1년까지는 해당 인터넷 사이트 등에 가입된 회원임을 확인하는
  방법으로 제1항에 따른 확인을 갈음할 수 있다.」

**「불특정 이용자 간 온라인 대화서비스를 제공하는 애플리케이션」 청소년유해매체물 결정 고시** — 여성가족부 고시 제2020-36호, 2020-09-10 —
https://www.mogef.go.kr/io/ind/io_ind_s030d.do?bbtSn=704988&mid=info306

- 게시 본문 — 「「청소년 보호법」 제7조 및 제9조, 같은 법 시행령 제9조에 의거 청소년보호위원회가 결정한 「불특정 이용자 간 온라인
  대화서비스를 제공하는 애플리케이션」 중 청소년에게 불건전한 교제를 조장 또는 매개할 우려가 있는 애플리케이션을 “청소년유해매체물”로
  결정하고, 같은 법 제21조에 따라 다음과 같이 고시합니다.」 「☞ 청소년유해매체물 목록표는 … “청소년유해매체물 보기” 참조」
- **최신본** — 부처 누리집의 고시 목록에서 이 고시는 제2020-36호 하나이고, 뒤의 개정은 검색으로 찾지 못했다. 고시를 낸 부처는 지금
  성평등가족부다(법 제2조 3호의 「성평등가족부장관이 고시한」, 2025. 10. 1. 개정).
- **대상 · 예외의 문장은 고시 게시 본문에 없다** — 목록표(첨부)로 넘기는데 그 페이지의 첨부 칸이 비어 있어 목록표 원문을 못 봤다. 아래는
  같은 날 부처가 낸 보도자료의 원문이다(정책브리핑 전재, https://www.korea.kr/briefing/pressReleaseView.do?newsId=156410259):
  - 「이번 고시에 따라 ▲실명 인증 또는 휴대전화 인증을 통한 회원관리, ▲대화 저장, ▲신고 기능 등 안전한 대화서비스를 위한 기술적 조치가
    없는 랜덤채팅앱은 청소년 보호법에서 규정된 청소년유해매체물로서 청소년 대상 제공 금지 등의 의무가 부여된다.」
  - 「청소년이 이용토록 제공하기 위해서는 채팅앱 이용자의 신원확인과 대화(채팅) 중 성범죄 유인 등의 피해 발생 시 대화내용을 저장하여
    증거 수집 및 신고가 가능하도록 함으로써, 청소년의 안전한 채팅환경을 위한 최소한의 장치를 갖추도록 한 것이다.」
  - 「다만, 불특정 이용자가 아닌 지인(知人) 기반의 대화서비스, 게임 등 주된 정보통신서비스에 연계하여 부가적인 형태로 제공되는
    대화서비스, 게시판, 댓글 형식 등 누구나 열람․시청할 수 있는 형태의 대화서비스는 이번 청소년유해매체물 범위에서 제외된다.」
  - 「유예기간 동안 기술적 조치를 마련하지 않은 랜덤채팅앱은 청소년유해매체물에 해당되어 사업자는 해당 랜덤채팅앱에 청소년유해표시(⑲금)와
    함께 별도의 성인인증 절차를 두어 청소년이 이용하지 않도록 해야 한다.」(시행 2020-12-11)

### 우리 기능과 한 줄씩

| 고시 · 법의 요건 | 우리 사실 | 상태 |
| --- | --- | --- |
| 불특정 이용자 간 온라인 대화서비스 | 지인 목록이 아니라 풀에서 점수 · 무작위로 모르는 사람을 보이고 1:1 로 대화한다. 지금은 수락 뒤에 방이 열린다 | **미확정** — 목록표의 정의 원문을 못 봤다. 수락을 거친 1:1 이 「불특정」에 드는지 원문으로 못 가른다 |
| 예외 — 주된 서비스에 연계한 부가 대화 | 주 서비스는 사주풀이(풀이권 판매)이고, 인연은 사주를 저장하면 자동으로 참여한다 | **미확정** — 「게임 등」의 예가 이 모양까지 넓은지는 고시 문장으로 안 나온다. 판단은 청소년보호위원회 · 부처 몫이다 |
| 예외 — 게시판 · 댓글처럼 누구나 열람 | 아니다 — 두 사람만 보는 방 | 예외에 들지 않는다(사실) |
| 불건전한 교제를 조장 또는 매개할 우려 | 추천 점수는 연인용 정책이다(PRD §6.1 「예측 궁합 점수의 연인용 정책」) | 사실만 둔다 — 판정하지 않는다 |
| 기술 조치 ① 실명 인증 또는 휴대전화 인증을 통한 회원관리 | 없다 — 구글 로그인 + 테스트 코드, 성인 확인 스위치 꺼짐 · 업체 없음 | **갖추지 않았다** |
| 기술 조치 ② 대화 저장 | 있다 — 서버 표, 닫힌 방 90일 뒤 삭제 | 있다. 저장 기간을 보도자료가 말하지 않아 90일이 충분한지는 **미확정** |
| 기술 조치 ③ 신고 | 있다 — 사람 · 메시지, 메시지 사본 | 있다 |
| 위치 정보 | 기기 위치를 안 쓴다 | 고시 · 보도자료의 조건에 위치는 없다 — 참고 사실 |
| 걸리면 — 나이 및 본인 확인(법 제16조①) | 사주용 생년월일은 이용자가 적은 값이다 | 시행령 제17조① 1~7 의 수단에 **이용자가 적은 생년월일은 없다** |

**결론(법)** — 고시가 우리에게 걸리는지는 **미확정**이다(목록표 원문 미확인 · 부가 대화 예외 · 「불특정」 해당 여부). 걸린다면 지금은
기술 조치 ① 이 없어 청소년유해매체물 쪽이고, 그때 드는 나이 · 본인 확인은 시행령 제17조의 수단이어야 한다 — 생년월일 자기신고는 그 목록에
없다. 거꾸로 세 조치를 다 갖추면 보도자료 문장으로는 유해매체물 범위에서 빠지며, 그때 법이 나이 확인을 따로 요구하는지는 이 고시로는 안 나온다.

## 2. 스토어 요구

### Google Play

- **Requirements for apps with incidental dating or matchmaking features** — https://support.google.com/googleplay/android-developer/answer/16838200
  - 「To protect users under 18 years of age from content that is not age-appropriate, our Age-Restricted Content and Functionality policy
    requires dating and matchmaking apps to use the Restrict Minor Access feature in Play Console.」
  - 「The policy may not apply to apps where the core functionality is not facilitating dating or matchmaking that include incidental dating
    or matchmaking features, provided these apps adopt appropriate minor protections and age-gating safeguards to prevent minors from
    accessing such mature features.」
  - 「**We do not mandate specific age-gating technologies.** As the developer, you are free to choose the method that is most appropriate
    for your app as long as it reasonably prevents minors from accessing the age-restricted dating or matchmaking content and functionality
    of your app.」
  - 「It is your responsibility to ensure that your age-gating mechanism is robust and effective. **Simple age gates that can be easily
    circumvented may not be considered reasonable.**」
- **Age-Restricted Content and Functionality** — https://support.google.com/googleplay/android-developer/answer/16302250 — 「apps meeting the
  descriptions below are required to use the Play Console functionality and tools to block minors:」 가운데
  - 「Apps whose core functionality is to facilitate matchmaking or dating. Apps where matchmaking or dating is an incidental feature are not
    required to block minors, provided they implement appropriate age-gating safeguards to prevent minors from accessing those specific features.」
  - 「Apps whose core functionality is to facilitate randomly connecting users to spontaneously communicate with people they do not know.」
- **Restrict Minor Access 가 하는 일** — https://support.google.com/googleplay/android-developer/answer/9867159 — 「Minors are determined based
  on the age provided in their Google Account or when our systems indicate that a user may be under 18. When this feature is enabled, users
  determined to be under 18 will not be able to search for, download or purchase the app. Additionally, users who have already installed the
  app will continue to be able to use it, …」

**결론(구글)** — 특정 인증 기술을 지정하지 않는다. 우리 앱의 핵심 기능이 매칭인지(그러면 Restrict Minor Access 가 필수), 부가 기능인지(그러면
앱이 고른 연령 확인 장치가 「robust and effective」해야 한다)는 구글이 판단하며 **미확정**이다. 덱의 무작위 자리 · 스위치 뒤의 수락 없는 대화가
「randomly connecting users …」 문장에 드는지도 **미확정**이다. 생년월일 자기신고가 「Simple age gates that can be easily circumvented」에 드는지는
구글의 판단이다 — **확인되지 않음**.

### Apple App Review Guidelines

https://developer.apple.com/app-store/review/guidelines/ (페이지의 「Last Updated: October 16, 2026」)

- 1.1.4 — 「Overtly sexual or pornographic material … This includes “hookup” apps and other apps that may include pornography or be used to
  facilitate prostitution, or human trafficking and exploitation.」
- 1.2 — 사용자 생성 콘텐츠 앱은 「To prevent abuse, such apps must include: A method for filtering objectionable material from being posted to
  the app · A mechanism to report offensive content and timely responses to concerns · The ability to block abusive users from the service ·
  Published contact information so users can easily reach you」. 「Apps with user-generated content or services that end up being used
  primarily for pornographic content, Chatroulette-style experiences, random or anonymous chat, … do not belong on the App Store and may be
  removed without notice.」
- 2.3.6 — 「Answer the age rating questions in App Store Connect honestly so that your app aligns properly with parental controls.」

**결론(애플)** — 데이팅 · 매칭 앱에 나이 확인이나 특정 인증 기술을 요구하는 조항은 이 문서에서 찾지 못했다. 「verified or declared age」는
1.2.1(a)(크리에이터 콘텐츠)와 4.7.5(미니 앱 등)의 조항이다 — 그 대상만 적고 우리에게 걸리는지는 판단하지 않는다. 연령 확인과 따로, 1.2 의
신고 · 차단은 있고(위 표), 올라오는 말을 거르는 자리는 `src/lib/chat` · `send_chat_message` 에서 찾지 못했다.

## 3. 자체 정책 — 저장소에 이미 정한 것

| 자리 | 정한 것 | 지금 |
| --- | --- | --- |
| ADR 0101(2026-09-23) | 가입 폼이 PASS 휴대폰 본인인증으로 시작하고 **만 19세 이상만 가입한다** | 없다 — G-20 `정했다`. 변호사 검토(G-25)가 끝날 때까지 본인확인을 실제로 열지 않는다(`docs/legal/README.md`) |
| ADR 0214(운영자 답 2026-11-02) | 성인 확인은 가입이 아니라 **인연 시작 때 최초 1회**. 상태는 확인 여부 · 시각뿐(CI · 생일 안 둠). 켜는 것은 후속 배포와 함께 승인 | 스위치 꺼짐 · 업체 없음(위 표). 켜는 PR 이 ADR 0101 · G-20 · 약관 제8조 · 처리방침 문장을 함께 고친다(ADR 0214 「고르지 않은 것」) |
| 게시된 약관 제8조② | 「만 19세 이상만 가입할 수 있습니다. 회사는 본인확인 결과의 생년월일로 나이를 확인하며, …」 | 문장은 게시돼 있으나 본인확인은 아직 가입의 문이 아니다 — `src/lib/brand/terms.ts:146` · `docs/legal/terms-grounds.md` 「미성년자 계약 취소 고지」 줄 |
| 화면 문구 | 「인연은 만 19세 이상만 이용할 수 있어요. 휴대전화 본인확인으로 성인 여부를 확인해요.」 | `src/lib/matching/adult-check.ts:7` — 확인 안내 화면에만 선다(스위치 꺼짐) |
| 최소 저장안(운영자 승인 2026-09-24) | 본인확인에서 남기는 것은 만 19세 이상 여부 · 확인 시각 · CI HMAC 셋 | `docs/product/gaps/records/g-20.md` — ADR 0214 는 CI 도 두지 않았다 |

**결론(자체)** — 저장소는 이미 「인연은 만 19세 이상, 휴대전화 본인확인으로」를 정했다(ADR 0101 · 0214 · 약관 제8조). 업체 · 켜는 날은 정하지 않았다.

## 운영자가 고를 수 있는 것 — 각각이 걸리는 근거

이 문서가 새로 정하는 것은 없다. 아래는 저장소에 이미 있는 자리(스위치 · ADR · 스토어 설정)로 할 수 있는 것뿐이다.

| 선택지 | 법(고시 · 제16조 · 시행령 제17조) | Google Play | Apple | 자체 정책 |
| --- | --- | --- | --- | --- |
| A. 지금 그대로 — 성인 확인 꺼짐, 사주용 생년월일(자기신고)만 | 고시가 걸리면 기술 조치 ① 이 없어 유해매체물 쪽. 자기신고는 시행령 제17조의 수단이 아니다 | 핵심 기능이 매칭이면 Restrict Minor Access 필수. 부가면 「Simple age gates … may not be considered reasonable」— **확인되지 않음** | 나이 확인 조항 없음. 1.2 · 2.3.6 | ADR 0101 · 0214 · 약관 제8조와 어긋난다 |
| B. A + 스토어 18+ 등급 · 구글 Restrict Minor Access | 앱 안의 나이 · 본인 확인이 아니다 — 법 쪽은 A 와 같다 | 핵심 기능이 매칭일 때 정책이 지정한 그 장치다. 이미 설치한 사람은 계속 쓴다 | 2.3.6 의 정직한 등급 | A 와 같이 어긋난다 |
| C. 인연 시작 때 휴대전화 본인확인으로 성인 확인(ADR 0214 의 스위치를 켠다) | 시행령 제17조①6 의 수단이다. 인연에 드는 사람만 인증하므로 고시의 「회원관리」에 해당하는지는 **미확정** | 기술 지정 없음 — 충분한지는 구글이 본다 | 걸리는 조항 없음 | ADR 0214 그대로. 업체 계약 · 앱 배포 · 켜는 승인이 남았다(`docs/ops/runbook/adult-check.md`) |
| D. 가입 때 본인확인(ADR 0101 원안) | 시행령 제17조①6. 모든 회원을 인증하므로 고시 ① 「회원관리」 쪽 | C 와 같다 | 걸리는 조항 없음 | ADR 0101 원안. 운영자 답(인연 시작 때, ADR 0214)과 다르다 |

B 는 C · D 와 함께 둘 수 있다. 어느 줄도 「적법」을 뜻하지 않는다.

## 미확정 — 다시 볼 때

- 고시 목록표(첨부)의 원문 — 대상 정의 · 예외 문장. 지금은 보도자료로만 옮겼다
- 「주된 서비스에 연계한 부가 대화」 예외가 사주 + 인연에 드는가 · 수락 뒤 1:1 이 「불특정」인가 — 청소년보호위원회 · 성평등가족부의 판단
- 인연 참여자만 인증하는 것(C)이 고시 ① 「회원관리」인가
- 구글이 우리 앱의 매칭을 핵심으로 보는가 부가로 보는가
- 자기신고 생년월일만으로 출시할 수 있는가 — **확인되지 않음**
