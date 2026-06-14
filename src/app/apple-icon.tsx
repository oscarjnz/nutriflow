import { ImageResponse } from 'next/og';

import { LEAF_PATH, VEIN_PATH } from '@/components/shared/logo';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#5b8047',
        }}
      >
        <svg width="180" height="180" viewBox="0 0 64 64">
          <path d={LEAF_PATH} fill="#ffffff" />
          <path d={VEIN_PATH} fill="none" stroke="#5b8047" strokeWidth={3} strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
