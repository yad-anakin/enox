import { ImageResponse } from 'next/og';

export const size = {
  width: 64,
  height: 64,
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000000',
          borderRadius: 16,
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 48 48"
          width="40"
          height="40"
          fill="none"
        >
          <path
            fill="white"
            stroke="white"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
            d="M38 30H10a6 6 0 0 0 0 12h28a6 6 0 0 0 0-12m-2-8a8 8 0 1 0 0-16a8 8 0 0 0 0 16M4 14l9-9l9 9l-9 9z"
          />
        </svg>
      </div>
    ),
    size,
  );
}
