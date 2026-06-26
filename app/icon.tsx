import { ImageResponse } from 'next/og'
 
// Route segment config
export const runtime = 'edge'
 
// Image metadata
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'
 
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0d1117',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '24%',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 16h4l4-9 5 18 4-13 3 4h4"
            stroke="#2f81f7"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="12"
            cy="7"
            r="3.5"
            fill="#2da44e"
            stroke="#0d1117"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}