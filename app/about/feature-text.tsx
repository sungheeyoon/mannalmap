'use client';

import { featureText, type ServiceFeature } from '@/src/lib/brand/features';

import { TYPE_META } from '../ui/surfaces';
import { useSignedOutMatchOpen } from '../signed-out-match-open';

/** 서비스 소개 카드의 본문과 조건 줄 — 소개는 미리 그려지므로 인연의 열림을 브라우저에서 읽는다(`featureText`) */
export function FeatureText({ feature }: { feature: ServiceFeature }) {
  const { body, note } = featureText(feature, useSignedOutMatchOpen());
  return (
    <>
      <p className="text-body leading-6 text-secondary">{body}</p>
      {note !== null && <p className={TYPE_META}>{note}</p>}
    </>
  );
}
