export function Cultiv8Logo({ className = "w-8 h-8", color = "currentColor" }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Infinity symbol with growth elements */}
      <g>
        {/* Left loop of infinity with sprouting element */}
        <path
          d="M 25 50 C 25 35, 35 25, 42 25 C 49 25, 50 35, 50 50 C 50 65, 49 75, 42 75 C 35 75, 25 65, 25 50 Z"
          stroke={color}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Right loop of infinity */}
        <path
          d="M 50 50 C 50 35, 51 25, 58 25 C 65 25, 75 35, 75 50 C 75 65, 65 75, 58 75 C 51 75, 50 65, 50 50 Z"
          stroke={color}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Sprouting leaves - representing cultivation */}
        {/* Top left sprout */}
        <path
          d="M 30 20 Q 25 15, 22 12"
          stroke={color}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 30 20 Q 28 16, 32 14"
          stroke={color}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Top right sprout */}
        <path
          d="M 70 20 Q 75 15, 78 12"
          stroke={color}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 70 20 Q 72 16, 68 14"
          stroke={color}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Center top sprout - representing growth */}
        <path
          d="M 50 18 L 50 8"
          stroke={color}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 50 12 Q 48 10, 46 11"
          stroke={color}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 50 12 Q 52 10, 54 11"
          stroke={color}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Small growth dots */}
        <circle cx="35" cy="30" r="1.5" fill={color} />
        <circle cx="65" cy="30" r="1.5" fill={color} />
        <circle cx="50" cy="25" r="1.5" fill={color} />
      </g>
    </svg>
  );
}

export function Cultiv8LogoSimple({ className = "w-8 h-8", color = "currentColor" }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Simplified infinity loop for smaller displays */}
      <path
        d="M 25 50 C 25 35, 35 25, 42 25 C 49 25, 50 35, 50 50 C 50 35, 51 25, 58 25 C 65 25, 75 35, 75 50 C 75 65, 65 75, 58 75 C 51 75, 50 65, 50 50 C 50 65, 49 75, 42 75 C 35 75, 25 65, 25 50 Z"
        stroke={color}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Single center sprout */}
      <path
        d="M 50 20 L 50 10"
        stroke={color}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 50 14 Q 47 11, 45 12"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 50 14 Q 53 11, 55 12"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

