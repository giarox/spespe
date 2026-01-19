export default function AspeLogo({ className = "w-8 h-8" }) {
  return (
    <svg 
      viewBox="0 0 72 72" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      <path d="M20 38C16 26 24 14 34 18" stroke="#F16B6B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M34 18C36 10 48 10 50 22" stroke="#F16B6B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M50 22C56 22 58 34 50 38" stroke="#F16B6B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20 38C22 52 48 54 52 38" stroke="#F16B6B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="30" cy="36" r="4" stroke="#F16B6B" strokeWidth="3"/>
      <circle cx="44" cy="36" r="4" stroke="#F16B6B" strokeWidth="3"/>
    </svg>
  );
}
