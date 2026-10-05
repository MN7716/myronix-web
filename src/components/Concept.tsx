import type { ConceptKind } from "../data/portfolio";
import { asset } from "../lib/asset";

const B = "#5170ff", N = "#202c65", P = "#cad2ff", W = "#ffffff", M = "#f4f5fb", I = "#14172b";

/** Abstract placeholder artwork for MYRONIX concepts. Decorative: parent supplies the text label. */
export default function Concept({ kind, className = "" }: { kind: ConceptKind | "board-poster"; className?: string }) {
  const frame = (children: React.ReactNode, bg = M) => (
    <svg viewBox="0 0 400 300" className={className} role="img" aria-label="" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="300" fill={bg} />{children}
    </svg>
  );
  switch (kind) {
    case "identity":
      return frame(<>
        <rect x="40" y="40" width="150" height="220" rx="6" fill={N} />
        <circle cx="115" cy="120" r="34" fill={B} /><rect x="70" y="190" width="90" height="10" rx="5" fill={P} /><rect x="70" y="212" width="60" height="8" rx="4" fill={B} />
        <rect x="210" y="40" width="150" height="100" rx="6" fill={W} /><rect x="228" y="64" width="70" height="10" rx="5" fill={I} /><rect x="228" y="86" width="100" height="8" rx="4" fill={P} />
        <rect x="210" y="160" width="68" height="100" rx="6" fill={B} /><rect x="292" y="160" width="68" height="100" rx="6" fill={P} />
      </>);
    case "poster":
      return frame(<>
        <rect x="60" y="30" width="130" height="240" fill={B} /><circle cx="125" cy="110" r="42" fill={P} /><rect x="80" y="190" width="90" height="12" fill={W} /><rect x="80" y="214" width="55" height="8" fill={N} />
        <rect x="210" y="30" width="130" height="240" fill={N} /><rect x="230" y="60" width="90" height="90" fill={B} /><rect x="230" y="170" width="90" height="12" fill={W} /><rect x="230" y="194" width="60" height="8" fill={P} />
      </>);
    case "browser":
      return frame(<>
        <rect x="40" y="36" width="320" height="228" rx="10" fill={W} />
        <rect x="40" y="36" width="320" height="30" rx="10" fill={N} /><circle cx="60" cy="51" r="4" fill={P} /><circle cx="74" cy="51" r="4" fill={P} /><circle cx="88" cy="51" r="4" fill={P} />
        <rect x="60" y="90" width="170" height="16" rx="4" fill={I} /><rect x="60" y="116" width="120" height="10" rx="4" fill={P} /><rect x="60" y="140" width="80" height="26" rx="13" fill={B} />
        <rect x="250" y="86" width="90" height="90" rx="6" fill={P} />
        <rect x="60" y="196" width="80" height="50" rx="4" fill={M} /><rect x="150" y="196" width="80" height="50" rx="4" fill={M} /><rect x="240" y="196" width="100" height="50" rx="4" fill={M} />
      </>);
    case "landing":
      return frame(<>
        <rect x="100" y="24" width="200" height="252" rx="8" fill={W} />
        <rect x="100" y="24" width="200" height="110" rx="8" fill={B} /><rect x="124" y="60" width="120" height="14" rx="4" fill={W} /><rect x="124" y="84" width="80" height="8" rx="4" fill={P} />
        <rect x="124" y="156" width="152" height="10" rx="4" fill={I} /><rect x="124" y="176" width="110" height="8" rx="4" fill={P} />
        <rect x="124" y="214" width="100" height="30" rx="15" fill={N} />
      </>);
    case "phone":
      return frame(<>
        <rect x="140" y="20" width="120" height="260" rx="20" fill={N} /><rect x="148" y="34" width="104" height="232" rx="12" fill={W} />
        <rect x="160" y="52" width="60" height="10" rx="5" fill={I} /><rect x="160" y="76" width="80" height="50" rx="8" fill={B} />
        <rect x="160" y="138" width="80" height="26" rx="8" fill={M} /><rect x="160" y="172" width="80" height="26" rx="8" fill={M} /><rect x="160" y="216" width="80" height="30" rx="15" fill={B} />
      </>);
    case "reel":
      // Raster workspace visual (4:3). Paths go through asset() so GitHub Pages sub-paths (/myronix-site/) work.
      return (
        <img
          src={asset("portfolio/video-editing-1200.jpg")}
          srcSet={`${asset("portfolio/video-editing-640.jpg")} 640w, ${asset("portfolio/video-editing-1200.jpg")} 1200w`}
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 100vw"
          width={1200} height={900} loading="lazy" decoding="async" alt="" aria-hidden="true"
          className={`${className} object-cover`}
        />
      );
    case "system":
      return frame(<>
        {[0, 1, 2].map((i) => <rect key={i} x={40 + i * 110} y="40" width="100" height="100" rx="6" fill={[B, N, P][i]} />)}
        {[0, 1, 2].map((i) => <rect key={i} x={40 + i * 110} y="160" width="100" height="100" rx="6" fill={[W, B, W][i]} />)}
        <rect x="56" y="186" width="60" height="8" rx="4" fill={I} /><rect x="166" y="186" width="50" height="8" rx="4" fill={W} /><rect x="276" y="186" width="60" height="8" rx="4" fill={I} />
      </>);
    default:
      return frame(<><rect x="60" y="30" width="130" height="240" fill={B} /><circle cx="125" cy="110" r="42" fill={P} /><rect x="80" y="190" width="90" height="12" fill={W} /></>, "none" as string);
  }
}
