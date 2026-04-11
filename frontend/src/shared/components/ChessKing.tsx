interface ChessKingProps {
  color: 'white' | 'black'
  size?: number
}

export function ChessKing({ color, size = 24 }: ChessKingProps) {
  const fill = color === 'white' ? '#fff' : '#1a1a1a'
  const stroke = color === 'white' ? '#333' : '#555'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 45 45"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 왕관 십자 */}
      <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round">
        <path d="M 22.5,11.63 L 22.5,6" strokeLinecap="round" />
        <path d="M 20,8 L 25,8" strokeLinecap="round" />
        {/* 몸체 */}
        <path
          d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25"
        />
        {/* 밑단 */}
        <path
          d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37"
        />
        {/* 장식선 */}
        <path d="M 12.5,30 C 18,27 27,27 32.5,30" fill="none" />
        <path d="M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5" fill="none" />
        <path d="M 12.5,37 C 18,34 27,34 32.5,37" fill="none" />
      </g>
    </svg>
  )
}
