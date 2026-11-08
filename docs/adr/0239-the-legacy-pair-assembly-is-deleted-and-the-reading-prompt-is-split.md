# 운영이 부르지 않는 옛 컷 원복 조립을 지우고, 풀이 프롬프트를 의미 단위 파일로 나눈다 — 실험의 견줄 짝이 쓰는 옛 궁합 세대는 남긴다

이 결정이 대체하는 것 — ADR 0067(일부 — 「원복」 대목과 옛 컷이 원복용으로 코드에 남는다는 줄) · ADR 0075(일부 — 「옛 세대를 지우지 않았다」의 원복 경로) · ADR 0207(일부 — 원복 조립의 한 줄 요약 대목)

> **채택 — 운영자 승인 2026-11-08**(#1085). 원복 조립을 지운다. 실험 변형 칸(G-157)은 프롬프트 실험 보류에 따라 `보류` 다.
>
> **2026-11-08 감사 라운드(레인 F, G-157).** 감사는 `src/lib/reading/prompt.ts`(1,933줄)가 지시 세대 세 벌(`self` · `pair-legacy` · `pair-guided`)과
> 2026-09-15 전 궁합을 되돌릴 조립(`LEGACY_PAIR_ASSEMBLY`)을 든다고 적었다. 그 문장을 가설로 두고 운영 경로가 옛 세대를 다시 부를 수 있는지 먼저 쟀다.

## 잰 것 — 운영은 옛 컷 조립에 닿지 않는다

| 길 | 조립을 어디서 고르나 | 옛 컷 조립에 닿나 |
| --- | --- | --- |
| 제출 · 복구기 재제출(`app/me/reading/submit.ts`) | `readingInputOf({ kind, charts, viewedAt, about })` — `assembly` 를 안 넘겨 기본값 `CONTROL` | 아니다 |
| 얼린 일감(`FrozenJob`) | 출생 입력 둘과 사이(`about.relation`)만 얼린다 — 조립 이름 · `pairReading` · `matchInput` 칸이 없다 | 아니다 |
| DB(`supabase/migrations/**`) | `legacy-v0` · `plain-v1` · `guide-v4` · `pair-legacy` 어느 글자도 없다. 저장되는 것은 지은 프롬프트 글과 판본 이름(`promptVersionOf(kind)`)이다 | 아니다 |
| 한 줄 요약 차례(`writesSummaryLast(kind)`) · 미리 보기(`app/me/reading/preview.ts`) | 기본값 `CONTROL` | 아니다 |
| 저장된 옛 풀이 되짚기 | 옛 프롬프트 글을 다시 읽어 기준점만 꺼낸다(`baselineIn`) · 옛 컷 자료는 검사가 판을 읽는다(`check.ts`) — 프롬프트를 다시 짓지 않는다 | 아니다 |
| 내부 화면(`/me/reading/inspect`) | 실험판을 세우지 않는다 — e2e 가 판의 id 로 잰다(`e2e/signed-in.spec.ts`) | 아니다 |
| 실험(`src/lab/reading/variants.ts`) | 절판 궁합 하나와 인연 궁합 입력 두 판이 `pairReading: 'plain-v1'` 로 옛 궁합 세대(`pair-legacy`)를 부른다. 옛 컷(`legacy-v0`)은 아무도 안 부른다 | 옛 컷은 아니다 · 옛 세대는 그렇다 |

**원복 조립은 이미 원복이 안 됐다.** 인연 궁합은 2026-11-04 부터 상세 궁합 하나라 제출이 늘 발견 칸이 든 스키마를 낸다(`discovery: kind === 'match'`).
옛 컷 조립의 지시는 그 칸을 모른다 — `CONTROL` 을 옛 조립으로 바꾸는 원복(ADR 0067)은 모델에게 없는 칸을 채우라는 요청이 된다.

## 정한 것

1. **원복 조립(`LEGACY_PAIR_ASSEMBLY`)과 옛 컷 지시를 지운다.** 조립의 `matchInput` 타입을 견주는 두 판(`ComparedMatchInput` —
   `limited-v1` · `extended-v1`)으로 좁혀, 옛 컷으로 지시를 짓는 자리를 타입이 막는다. 옛 컷 자료(`legacy-v0`)는 그대로다 — 저장된 풀이를
   되짚는 검사가 읽는다.
2. **옛 궁합 세대(`pair-legacy`)는 남긴다.** 실험의 견줄 짝 셋(`pair-sections-v1` · `match-limited-v1` · `match-extended-v1`)이 부르고, 실험은
   보류 중이라 지우지 않는다(ADR 0139). 그 짝들을 지울지는 운영자가 다시 꺼내 정한다 — G-157(`보류`, 2026-11-08).
3. **`prompt.ts` 를 의미 단위로 나눈다** — 조립과 세대(`prompt-assembly.ts`) · 말투와 용어(`prompt-voice.ts`) · 4판 궁합의 제 벌
   (`prompt-guided.ts`) · 개인 풀이 절(`prompt-self.ts`) · 궁합 본문 절(`prompt-pair.ts`) · 자리 표와 입구(`prompt.ts`). 바깥이 부르는
   이름은 그대로 `prompt.ts` · `index.ts` 에서 나간다. 새 조각 다섯도 브라우저 그래프에 못 닿는다(`scripts/layers.test.ts`).

## 운영 글자는 한 바이트도 안 바뀌었다

- `scripts/old-reading-prompts-unchanged.test.ts` 의 여섯 지문(개인 · 비공개 궁합 · 인연 궁합 · 사이 셋)은 지우기 전 main(`dc074b06`)의 값 그대로 초록이다.
  옛 컷 지문 하나만 뺐다.
- 그보다 넓게 — 명식 넷(시각 모름 하나 포함)의 모든 짝 · 사이 넷 · 네 kind 의 지은 프롬프트, 몸통(`READING_PROMPTS`), 자리 목록, 절 글, 기준점 되읽기,
  실험 변형 아홉 벌의 프롬프트까지 9.3MB 를 지우기 전과 뒤에 떠서 `cmp` 로 견줬다 — 같다. 판본 이름(`READING_POLICY`)은 그대로라 실호출이 들지 않는다.

## 안 한 것

- `pair-legacy` 세대 · 절판(`sections-v1`) · 용어 옛 판(`annotated`) · 옛 뼈대(`expert-v3`) · 확장형 입력(`extended-v1`)의 지시는 남는다 — 모두 실험의
  견줄 짝만 부른다. 지우면 `prompt-*.ts` 에서 약 300줄과 갈림길이 함께 빠진다(G-157).
- 시험 표(`prompt-plan.test.ts`)에서 옛 컷 조합 셋(원복 둘 · 옛 컷에 4판을 건 하나)을 뺐다. 옛 컷이 타입에서 못 서므로 잴 것이 없다. 옛 궁합 세대는
  `private/plain` · 견줄 짝 셋으로 계속 잰다 — ADR 0075 의 「걷는 날은 원복 경로를 걷는 날과 같아야 한다」가 오늘이다.
