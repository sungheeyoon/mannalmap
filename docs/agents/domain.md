# Domain Docs

This is a single-context repository. Engineering skills must use the root domain glossary and the
root ADR directory when exploring, planning, testing, or changing the codebase.

## Read before working

- Read the glossary area files under `docs/context/` that your role document (`docs/roles/`) points to — the index
  `GLOSSARY.md` says which file holds which section; not every file. It is
  the project's domain language; open another section only when the work meets a word it defines.
- Read the relevant decisions under `docs/adr/` before working in an affected area.
- Read supporting product or analysis documents when an ADR or the glossary routes to them.

If a document does not exist, proceed without suggesting that it be created pre-emptively. Domain
documentation should grow only when a term or decision is actually resolved.

## Use the glossary vocabulary

Use terms exactly as `GLOSSARY.md` defines them in issues, PRDs, implementation plans, tests, and code.
Do not replace them with synonyms that the glossary explicitly marks as ambiguous or discouraged.

If a necessary concept is missing, first check whether it is an accidental synonym. If it is a real
domain gap, flag it for resolution rather than silently inventing a competing term.

## Respect ADRs

Surface conflicts with an existing ADR explicitly. Do not silently override a recorded decision. A
change that reopens an ADR must explain why its original evidence or constraints no longer apply.

## Writing an ADR

Which ADR holds now, by area, is `docs/adr/README.md` — it points, it does not restate.

- **새 ADR 은 색인(`docs/adr/README.md`)에 줄을 더하고, 대체하는 ADR 의 머리에 후속 결정 줄을 단다.** 머리 줄은
  `> 후속 결정: ADR NNNN — <무엇이 대체됐나>` 이고 그 ADR 이 통째로 서지 않을 때다 — 그러면 색인에서 그 번호를 걷는다.
  일부만 대체됐으면 `> 후속 결정(일부): …` 로 달고 색인에 그대로 둔다. `scripts/code-rules.test.ts` 가 둘을 잰다.
  대체당한 쪽의 표지는 이 꼴 하나다 — `> 대체됨:` 같은 다른 꼴은 시험이 붉힌다. 대체하는 쪽은 머리에
  `이 결정이 대체하는 것 — ADR NNNN …` 으로 적고, 시험이 거기 든 번호마다 머리에 짝 줄이 있는지 견준다.
- **머지된 ADR 본문은 다시 쓰지 않는다(ADR 0240 의 2).** 정책이 바뀌면 새 ADR 을 쓰고, 옛 ADR 머리에는 위의 후속 결정 줄 하나만 단다 —
  `## 추기 …` 절은 더 달지 않는다. 예외는 둘이다 — 사실 정정(정책은 그대로이고 ADR 의 문장이 코드와 다를 때, 짧은 `## 정정 …` 절 하나)과
  깨진 링크 · 오타. 이미 있는 추기는 그대로 둔다. 2026-11-08 에 정한 뒤에도 머지된 ADR 에 추기 16개가 더 붙었다(2026-11-19 감사) —
  이 줄이 이 절에 없었다.
