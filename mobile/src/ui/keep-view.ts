/**
 * **모서리를 지키는 뷰** — 처음에 바탕이 없다가 고르거나 누르면 바탕이 서는 둥근 자리에 펼친다(`<View {...KEEP_VIEW} style={…}>`).
 *
 * 안드로이드(새 구조, RN 0.88.1)는 바탕 · 테두리가 없는 뷰를 펼쳐 없앤다(view flattening). 나중에 바탕이 서면 그 자리에 네이티브 뷰를
 * 새로 짓는데, 바뀐 값(`backgroundColor`)만 받고 `borderRadius` 는 못 받아 **둥근 표시가 네모로 선다** — 2026-11-05 운영 APK 의 하단 탭이
 * 그랬다. https://github.com/react/react-native/issues/52415 · 고치는 PR https://github.com/react/react-native/pull/56588 은 아직
 * 머지 전이고, 그 깃발(`enableAccumulatedUpdatesInRawPropsAndroid`)은 0.88.1 에서 꺼져 있다.
 * `collapsable: false` 면 처음부터 네이티브 뷰라 모서리를 첫 값으로 받는다(`ViewShadowNode.cpp` 의 `formsStackingContext`).
 *
 * 그 자리를 빠뜨리면 `scripts/mobile-surfaces.test.ts` 가 붉다. 위 PR 이 들어간 판으로 올리면 이 파일과 그 시험을 함께 걷는다.
 */
export const KEEP_VIEW = { collapsable: false } as const;
