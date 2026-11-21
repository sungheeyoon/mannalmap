# Domain Docs

This is a single-context repository. Engineering skills use the root domain glossary and the root ADR directory when
exploring, planning, testing, or changing the codebase.

## Read before working

- Glossary: `GLOSSARY.md` is the index; the definitions live in area files under `docs/context/`. Read the ones your role
  document (`docs/roles/`) points to, and open another only when the work meets a word it defines.
- Decisions: `docs/adr/` — read the ones that cover the area you touch.

If a document does not exist, proceed without suggesting that it be created pre-emptively.

## Use the glossary vocabulary

Use terms exactly as `GLOSSARY.md` defines them in issues, PRDs, plans, tests, and code — not the synonyms it marks as
ambiguous or discouraged. If a needed concept is missing, check first whether it is an accidental synonym; if it is a real
gap, flag it rather than inventing a competing term.

## Respect ADRs

Surface conflicts with an existing ADR explicitly; do not silently override one. A change that reopens an ADR explains why
its original evidence or constraints no longer apply.

## Writing an ADR

Which ADR holds now, by area, is `docs/adr/README.md` — it points, it does not restate.

- 새 ADR 은 색인(`docs/adr/README.md`)에 줄을 더한다. 대체하는 쪽은 머리에 `이 결정이 대체하는 것 — ADR NNNN …` 을 적고, 대체당한 ADR 머리에
  `> 후속 결정: ADR NNNN — <무엇이 대체됐나>` 를 달아 색인에서 그 번호를 지운다. 일부만 대체됐으면 `> 후속 결정(일부): …` 로 달고 색인에 둔다.
  다른 표지 꼴(`> 대체됨:` 등)과 짝이 없는 줄은 `scripts/code-rules.test.ts` 가 잡는다.
- 머지된 ADR 본문은 다시 쓰지 않는다 — 정책이 바뀌면 새 ADR 과 옛 ADR 머리의 후속 결정 줄 하나다. `## 추기 …` 절은 더 달지 않는다(시험이
  ADR 마다 추기 수를 지문으로 확인한다). 예외는 사실 정정(정책은 그대로이고 문장이 코드와 다를 때, 짧은 `## 정정 …` 절 하나)과 깨진 링크 · 오타.
