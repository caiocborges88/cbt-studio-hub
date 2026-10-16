export function Mascot({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 340 260"
      role="img"
      aria-label="Uma raposa exploradora entre livros e plantas"
    >
      <ellipse cx="178" cy="234" rx="121" ry="12" fill="#cbd8b8" opacity=".5" />
      <path d="M50 206c-24-31-17-72 0-95 1 29 22 35 25 65" fill="#8baa87" />
      <path d="M59 213c-5-31 8-56 29-69-6 27 3 42-16 66" fill="#b3c39b" />
      <path d="M273 216c-5-33 8-60 30-81 2 27-9 58-18 82" fill="#8baa87" />
      <rect x="57" y="212" width="78" height="16" rx="5" fill="#d5ab7e" />
      <rect x="47" y="196" width="87" height="16" rx="5" fill="#e9cfaa" />
      <path d="M67 201h55m-47 17h43" stroke="#fff5e5" strokeWidth="3" />
      <path d="M225 203c58-12 78-44 52-86-1 28-21 28-42 32" fill="#cf8355" />
      <path
        d="M276 118c-1 17-12 26-23 31 6-1 11 3 15 7 14-13 19-26 8-38"
        fill="#fff0d5"
      />
      <path
        d="M120 195c-7-59 12-93 58-93 44 0 66 40 58 93l-8 32H129Z"
        fill="#df9b65"
      />
      <path
        d="m127 121-9-63c20 0 42 20 49 35m29 0c8-22 27-32 44-35l-9 62"
        fill="#cf8355"
      />
      <path d="m132 102-5-27 25 20m59 0 20-20-4 28" fill="#a85e45" />
      <ellipse cx="178" cy="137" rx="60" ry="48" fill="#e3a16a" />
      <path
        d="M120 132c23-3 39 6 58 26 17-20 33-29 58-26-2 34-27 53-58 53s-56-19-58-53"
        fill="#fff0d5"
      />
      <path
        d="M143 132q8-9 16 0m38 0q8-9 16 0"
        stroke="#674c38"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <path d="m172 149 6 7 6-7Z" fill="#674c38" />
      <path
        d="M171 162q7 7 14 0"
        fill="none"
        stroke="#674c38"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="142" cy="150" r="6" fill="#e9b397" />
      <circle cx="215" cy="150" r="6" fill="#e9b397" />
      <path d="M141 187q35-18 73 0v39h-73Z" fill="#f4ddb6" />
      <path d="m135 190 43 10 43-10v37l-43 10-43-10Z" fill="#527860" />
      <path d="M178 200v37" stroke="#b2c29d" strokeWidth="2" />
      <path
        d="m143 200 25 6m-25 3 25 6m21-9 25-6m-25 15 25-6"
        stroke="#d3dfc4"
        strokeWidth="2"
      />
      <ellipse cx="133" cy="200" rx="12" ry="10" fill="#df9b65" />
      <ellipse cx="224" cy="200" rx="12" ry="10" fill="#df9b65" />
      <path
        d="m82 72 4-10 4 10 10 4-10 4-4 10-4-10-10-4Zm172-40 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z"
        fill="#d8b271"
      />
      <circle cx="71" cy="130" r="4" fill="#d8b271" />
      <circle cx="269" cy="80" r="4" fill="#92ae88" />
    </svg>
  );
}
