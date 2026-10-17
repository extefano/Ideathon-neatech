import { ImageResponse } from 'next/og';

export const alt = 'Muunar — Trazabilidad ganadera EUDR';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#faf7f0',
        gap: 28,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            border: '16px solid #fdda24',
            display: 'flex',
          }}
        />
        <div style={{ fontSize: 104, color: '#1c1917' }}>Muunar</div>
      </div>
      <div style={{ fontSize: 40, color: '#8a6a00' }}>Trazabilidad ganadera EUDR · Stellar</div>
    </div>,
    size,
  );
}
