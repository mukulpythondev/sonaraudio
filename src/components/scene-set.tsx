import { ENVIRONMENTS, type Environment, type Speaker } from "@/lib/scene";

export const CAST: Record<Speaker, string> = { a: "Akshat", b: "Priyanshu" };

export function SceneSet({ environment, activeSpeaker, rehearsal }: {
  environment: Environment; activeSpeaker: Speaker | null; rehearsal: boolean;
}) {
  const setting = ENVIRONMENTS.find((item) => item.id === environment);
  return (
    <section className={`performance-set set-${environment}`} aria-label={`${setting?.name} visual set with Akshat and Priyanshu`}>
      <div className="set-heading"><span>THE SET / {setting?.name}</span><span>{rehearsal ? "BROWSER REHEARSAL" : "FISH AUDIO VOICES"}</span></div>
      <svg className="set-art" viewBox="0 0 1000 350" aria-hidden="true" focusable="false">
        <rect width="1000" height="350" fill="var(--set-wall)" />
        {environment === "studio" && <g>
          {[70, 270, 630, 830].map((x) => <g key={x}><rect x={x} y="35" width="100" height="170" rx="3" fill="#202b2c" />{[0, 1, 2, 3, 4].map((n) => <path key={n} d={`M${x + 12 + n * 19} 45v150`} stroke="#354443" strokeWidth="7" />)}</g>)}
          <rect x="420" y="60" width="160" height="51" rx="3" fill="#161f20" stroke="#65776d" />
          <text x="500" y="83" textAnchor="middle" fill="#e6cdb0" fontFamily="monospace" fontSize="12" letterSpacing="3">SONARAUDIO</text>
          <text x="500" y="100" textAnchor="middle" fill="#a7b9a9" fontFamily="monospace" fontSize="8" letterSpacing="2">THE CONVERSATION ROOM</text>
          <path d="M0 235h1000" stroke="#64726a" />
        </g>}
        {environment === "cafe" && <g>
          <rect x="35" y="25" width="260" height="190" fill="#c0d2c0" stroke="#796e52" strokeWidth="8" />
          <path d="M165 25v190M35 115h260" stroke="#796e52" strokeWidth="7" />
          <path d="M55 200l50-87 60 87 60-120 55 120" fill="#7f9679" />
          <rect x="710" y="50" width="230" height="115" fill="#39463c" stroke="#9f8868" strokeWidth="7" />
          <text x="825" y="90" textAnchor="middle" fill="#e5d5b8" fontFamily="Georgia,serif" fontSize="22">The Corner Table</text>
          <path d="M760 110h130M785 125h80" stroke="#b6b89d" strokeWidth="2" />
          {[400, 600].map((x) => <g key={x}><path d={`M${x} 0v40`} stroke="#413e30" strokeWidth="3" /><path d={`M${x - 30} 63q30-50 60 0z`} fill="#9c613b" /><ellipse cx={x} cy="63" rx="28" ry="5" fill="#eed1a1" /></g>)}
          <rect x="910" y="225" width="50" height="48" rx="3" fill="#9d7254" /><path d="M935 230v-65m0 38q-44-5-28-35 29 0 28 35m0-12q36-10 26-38-27 5-26 38" fill="#667b4f" stroke="#667b4f" strokeWidth="3" />
        </g>}
        {environment === "campfire" && <g>
          <circle cx="795" cy="58" r="24" fill="#e5d6b0" /><circle cx="805" cy="50" r="23" fill="var(--set-wall)" />
          {[80, 160, 290, 460, 570, 690, 890, 940].map((x, i) => <circle key={x} cx={x} cy={22 + (i * 31) % 100} r={i % 2 ? 1.5 : 2} fill="#c1c8c0" />)}
          <path d="M0 215l100-145 75 120 110-160 110 175 95-125 100 125 95-155 110 145 90-115 115 140v100H0z" fill="#253d3d" />
          <path d="M0 250l100-90 90 110 110-120 120 130 120-100 120 105 110-115 120 105 110-120v195H0z" fill="#1c302f" />
          <path d="M0 294q230-60 500-15 250-45 500 15v56H0z" fill="#28352d" />
        </g>}
        <g transform="translate(310 0)"><Host variant="a" active={activeSpeaker === "a"} headphones={environment === "studio"} /></g>
        <g transform="translate(690 0)"><Host variant="b" active={activeSpeaker === "b"} headphones={environment === "studio"} /></g>
        {environment !== "campfire" ? <g>
          <path d="M210 272h580l60 58H150z" fill={environment === "cafe" ? "#9b7050" : "#526358"} />
          <path d="M150 330h700v20H150z" fill={environment === "cafe" ? "#6d4d39" : "#31443a"} />
          <path d="M240 350v-20m520 20v-20" stroke="#232e2b" strokeWidth="12" />
          <Microphone x={410} y={225} mirror={false} /><Microphone x={590} y={225} mirror />
          {environment === "cafe" && <g fill="#efddbd" stroke="#6d4d39" strokeWidth="2"><path d="M280 282h25v21h-25zM305 285q15 0 10 12h-10M690 282h25v21h-25zM715 285q15 0 10 12h-10" /></g>}
        </g> : <g>
          <path d="M235 294h150m230 0h150" stroke="#6b5140" strokeWidth="22" strokeLinecap="round" />
          <path d="M467 325l66 12m-67 0 65-12" stroke="#8b6244" strokeWidth="10" strokeLinecap="round" />
          <path d="M500 334q-45-20-20-61 0 17 14 21 0-35 17-48-5 35 14 52 21 25-25 36z" fill="#d28c42" />
          <path d="M500 334q-22-17-5-37 2 12 9 10 0-13 7-18 14 31-11 45z" fill="#f0c16d" />
          <Microphone x={410} y={243} mirror={false} /><Microphone x={590} y={243} mirror />
        </g>}
      </svg>
      <div className="set-cast">
        {(["a", "b"] as const).map((speaker) => <div key={speaker} className={activeSpeaker === speaker ? "set-host current-host" : "set-host"}>
          <span className={`cast-initial cast-${speaker}`}>{CAST[speaker][0]}</span>
          <span><strong>{CAST[speaker]}</strong><small>{speaker === "a" ? "The curious host / Voice A" : "The counterpoint / Voice B"}</small></span>
          <span className="turn-label">{activeSpeaker === speaker ? "Current turn" : "On set"}</span>
        </div>)}
      </div>
      <p className="set-caption">Illustrated characters. Display names only. Visual scenery does not add background audio.</p>
    </section>
  );
}

function Host({ variant, active, headphones }: { variant: Speaker; active: boolean; headphones: boolean }) {
  const first = variant === "a";
  return <g>
    {active && <circle cx="0" cy="165" r="58" fill="none" stroke="#e6c894" strokeWidth="2" strokeDasharray="4 7" />}
    <path d="M-48 270v-35q0-33 28-38h40q28 5 28 38v35z" fill={first ? "#b77451" : "#748b80"} />
    <path d="M-13 185v22q13 13 26 0v-22" fill="#bd8969" />
    <ellipse cy="160" rx="32" ry="39" fill={first ? "#cc9a78" : "#b98665"} />
    <path d={first ? "M-32 158q-9-54 28-45 42-8 37 45l-12-20q-22 10-38-3z" : "M-32 155q-7-49 30-45 42 1 34 48l-10-24q-36 5-44-1z"} fill="#292d2b" />
    <path d="M-15 159h5m20 0h5" stroke="#30312b" strokeWidth="3" strokeLinecap="round" />
    <path d="M-8 177q8 6 16 0" fill="none" stroke="#764e3c" strokeWidth="2" strokeLinecap="round" />
    {!first && <path d="M-25 175q25 40 50 0-3 32-25 28-23 0-25-28" fill="#34332d" />}
    {headphones && <g fill="none" stroke="#172324" strokeWidth="8"><path d="M-39 162v-15q0-47 39-47t39 47v15" /><path d="M-38 148v24m76-24v24" strokeWidth="12" strokeLinecap="round" /></g>}
    <path d="M-38 232l-8 35 33 10m51-45 8 35-33 10" fill="none" stroke={first ? "#cc9a78" : "#b98665"} strokeWidth="13" strokeLinecap="round" />
  </g>;
}

function Microphone({ x, y, mirror }: { x: number; y: number; mirror: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${mirror ? -1 : 1} 1)`}>
    <path d="M-55 80v-18l38-28-17-27" stroke="#182425" strokeWidth="5" fill="none" strokeLinejoin="round" />
    <path d="M-64 80h21" stroke="#182425" strokeWidth="6" strokeLinecap="round" />
    <g transform="translate(-36 0) rotate(-28)"><rect x="-9" y="-23" width="18" height="39" rx="8" fill="#1c2929" stroke="#9aa79a" strokeWidth="2" /><path d="M-5-16h10m-10 6h10m-10 6h10" stroke="#8b9c90" strokeWidth="2" /></g>
  </g>;
}
