import type { ReactNode } from 'react'
import type { CareerKey } from './CareerEmblem'

// The illustration of each group of careers inside its medal: the five drawings of the approved draft (two-tone blue with a white outline and
// touches of yellow), redrawn as vectors so they stay sharp at any size. Each one is drawn in an 800 x 800 box whose centre is the centre of the
// enamel disc; `Insignia.tsx` scales the box to the disc.
//   sistemas   a laptop with code           industrial a robot arm with its measures        civil   a suspension bridge over the water
//   biomec     a sprout out of a hexagonal nut with gears and a pulse                       tronicas a chip with its circuit, gears and robot arms
export type InsigniaKey = Exclude<CareerKey, 'general'>
/** The five engineering medals plus the generic one (for the other career of a double program that is not an engineering). */
export type MedalKey = CareerKey

const mix = (c: string, pct: number, other: string) => `color-mix(in srgb, ${c} ${pct}%, ${other})`
const WHITE = 'white'
const YEL = 'var(--puj-yellow)'
const NAVY = mix('var(--puj-blue)', 55, 'black') // the dark screen of the laptop
const FILL = mix('var(--puj-blue)', 74, 'black') // the filled parts of the drawings
const SKY = mix('var(--puj-blue)', 40, 'white') // the light blue lines
const GREEN = 'hsl(140 52% 58%)'

const line = (stroke: string, w: number) => ({ fill: 'none', stroke, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const })
const solid = (fill: string, stroke: string, w: number) => ({ fill, stroke, strokeWidth: w, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const })
const rad = (d: number) => (d * Math.PI) / 180

/** A toothed wheel outline with a hole. */
function Gear({ cx, cy, r, teeth, stroke, w, fill = 'none' }: { cx: number; cy: number; r: number; teeth: number; stroke: string; w: number; fill?: string }) {
  const step = 360 / teeth
  const ri = r * 0.78
  const pts: string[] = []
  for (let i = 0; i < teeth; i++) {
    const a = i * step
    for (const [da, rr] of [[-step * 0.3, ri], [-step * 0.17, r], [step * 0.17, r], [step * 0.3, ri]] as const) {
      pts.push(`${(cx + rr * Math.cos(rad(a + da))).toFixed(1)} ${(cy + rr * Math.sin(rad(a + da))).toFixed(1)}`)
    }
  }
  return (
    <>
      <path d={`M${pts.join('L')}Z`} {...solid(fill, stroke, w)} />
      <circle cx={cx} cy={cy} r={r * 0.32} {...line(stroke, w)} />
    </>
  )
}

const Spark = ({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) => (
  <path d={`M${x} ${y - s}L${x + s * 0.28} ${y - s * 0.28}L${x + s} ${y}L${x + s * 0.28} ${y + s * 0.28}L${x} ${y + s}L${x - s * 0.28} ${y + s * 0.28}L${x - s} ${y}L${x - s * 0.28} ${y - s * 0.28}Z`} fill={fill} />
)

function Sistemas() {
  const rows: [string, number, number, number, number][] = [
    [YEL, 218, 284, 310, 242],
    [SKY, 238, 300, 305, 268],
    [WHITE, 238, 312, 345, 262],
    [GREEN, 252, 326, 322, 292],
    [SKY, 258, 342, 350, 298],
    [YEL, 245, 362, 298, 338],
    [WHITE, 248, 379, 333, 340],
    [SKY, 266, 391, 326, 362],
    [GREEN, 240, 414, 286, 398],
    [SKY, 242, 438, 316, 404],
  ]
  return (
    <>
      <path d="M168 274L402 164L438 382L205 496Z" {...solid(NAVY, WHITE, 13)} />
      <path d="M190 282L395 184L425 372L220 470Z" {...line(SKY, 3)} strokeOpacity=".6" />
      {rows.map(([c, x1, y1, x2, y2], i) => (
        <path key={i} d={`M${x1} ${y1}L${x2} ${y2}`} {...line(c, 9)} />
      ))}
      {[290, 310, 332, 352, 372, 392, 412, 432].map((y) => (
        <path key={y} d={`M${203 + (y - 290) * 0.1} ${y}l8 -3`} {...line(WHITE, 5)} strokeOpacity=".85" />
      ))}
      <path d="M205 496L437 382L600 462L368 580Z" {...solid(FILL, WHITE, 13)} />
      <path d="M208 514L368 594L598 480" {...line(WHITE, 8)} />
      {[[252, 494, 436, 408], [270, 504, 456, 418], [290, 514, 490, 432]].map(([x1, y1, x2, y2]) => (
        <path key={x1} d={`M${x1} ${y1}L${x2} ${y2}`} {...line(SKY, 8)} />
      ))}
      <path d="M372 508L458 468L496 486L406 528Z" {...line(SKY, 5)} />
      <Spark x={514} y={242} s={24} fill={YEL} />
      <Spark x={571} y={309} s={10} fill={SKY} />
      <Spark x={172} y={559} s={10} fill={SKY} />
    </>
  )
}

function Industrial() {
  return (
    <>
      <path d="M232 300Q216 340 232 392" {...line(SKY, 3)} strokeOpacity=".7" />
      <path d="M470 196Q585 230 548 440" {...line(SKY, 3)} strokeOpacity=".7" />
      {/* base and pedestal */}
      <path d="M410 608H618V640H410Z" {...solid(FILL, WHITE, 11)} />
      <path d="M446 604L470 540H585L604 604Z" {...solid(FILL, WHITE, 11)} />
      {[556, 570, 584].map((y) => (
        <path key={y} d={`M${462 - (y - 556) * 0.25} ${y}H${576 + (y - 556) * 0.3}`} {...line(WHITE, 5)} strokeOpacity=".85" />
      ))}
      {/* lower arm */}
      <path d="M458 456L440 292H524L548 446Z" {...solid(FILL, WHITE, 11)} />
      {[322, 348, 374, 400, 426].map((y) => (
        <path key={y} d={`M${444 + (y - 292) * 0.02} ${y}H${530 + (y - 292) * 0.12}`} {...line(WHITE, 5)} />
      ))}
      {/* upper arm */}
      <path d="M296 196L432 222L436 266L298 236Z" {...solid(FILL, WHITE, 11)} />
      {[322, 349, 377, 405].map((x, i) => (
        <path key={x} d={`M${x} ${204 + i * 4}V${240 + i * 6}`} {...line(WHITE, 5)} />
      ))}
      {/* forearm and gripper */}
      <path d="M248 244H276V372H248Z" {...solid(FILL, WHITE, 11)} />
      <path d="M226 372H300V392H226Z" {...solid(FILL, WHITE, 11)} />
      <path d="M200 392H306V404H200Z" {...solid(WHITE, WHITE, 6)} />
      <path d="M204 404L192 434L214 478M302 404L314 434L292 478" {...line(WHITE, 10)} />
      <path d="M212 466L224 476M294 466L282 476" {...line(YEL, 9)} />
      {/* joints */}
      <circle cx="512" cy="490" r="52" {...solid(FILL, WHITE, 11)} />
      <circle cx="512" cy="490" r="34" {...line(WHITE, 6)} />
      <circle cx="512" cy="490" r="14" fill={YEL} />
      <circle cx="468" cy="242" r="42" {...solid(FILL, WHITE, 11)} />
      <circle cx="468" cy="242" r="26" {...line(WHITE, 5)} />
      <circle cx="468" cy="242" r="12" fill={YEL} />
      <circle cx="262" cy="212" r="32" {...solid(FILL, WHITE, 11)} />
      <circle cx="262" cy="212" r="10" fill={YEL} />
      <path d="M576 470H606Q614 470 614 478V516Q614 524 606 524H576Z" {...solid(FILL, WHITE, 8)} />
      <path d="M584 446V470M600 446V470" {...line(WHITE, 6)} />
      {/* measures */}
      <path d="M640 206V388M624 206H656M624 388H656" {...line(YEL, 5)} />
      <path d="M160 538H346M160 522V554M346 522V554" {...line(YEL, 5)} />
    </>
  )
}

const bez = (p: [number, number][], t: number): [number, number] => {
  const u = 1 - t
  return [u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0], u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]]
}
const LEFT: [number, number][] = [[150, 480], [260, 470], [340, 400], [432, 230]]
const RIGHT: [number, number][] = [[495, 236], [555, 320], [620, 382], [665, 402]]
const deckTop = (x: number) => 516 - (x - 135) * 0.1853

function Civil() {
  const hangers = [
    ...Array.from({ length: 12 }, (_, i) => bez(LEFT, 0.08 + i * 0.075)),
    ...Array.from({ length: 8 }, (_, i) => bez(RIGHT, 0.14 + i * 0.115)),
  ]
  return (
    <g transform="translate(0 -26)">
      {/* the deck: a dark bar with a white outline and a yellow stripe, like the filled parts of the other drawings */}
      <path d="M135 518L664 420V452L135 558Z" {...solid(FILL, WHITE, 10)} />
      <path d="M140 540L660 438" {...line(YEL, 8)} />
      {hangers.map(([x, y], i) => (
        <path key={i} d={`M${x.toFixed(1)} ${y.toFixed(1)}V${deckTop(x).toFixed(1)}`} {...line(WHITE, 5)} />
      ))}
      <path d={`M${LEFT[0][0]} ${LEFT[0][1]}C${LEFT[1][0]} ${LEFT[1][1]} ${LEFT[2][0]} ${LEFT[2][1]} ${LEFT[3][0]} ${LEFT[3][1]}`} {...line(WHITE, 13)} />
      <path d={`M${RIGHT[0][0]} ${RIGHT[0][1]}C${RIGHT[1][0]} ${RIGHT[1][1]} ${RIGHT[2][0]} ${RIGHT[2][1]} ${RIGHT[3][0]} ${RIGHT[3][1]}`} {...line(WHITE, 13)} />
      {/* the tower: a filled, outlined body with X bracing, a cap and a foot */}
      <path d="M432 212H496V606H432Z" {...solid(FILL, WHITE, 11)} />
      <path d="M436 232L492 316M492 232L436 316M436 336L492 420M492 336L436 420M436 440L492 524M492 440L436 524M436 536L492 600M492 536L436 600" {...line(WHITE, 6)} />
      <path d="M432 322H496M432 430H496M432 530H496" {...line(WHITE, 9)} />
      <path d="M416 190H512V214H416Z" {...solid(WHITE, WHITE, 8)} />
      <path d="M402 606H526V638H402Z" {...solid(FILL, WHITE, 11)} />
      <path d="M150 668q32 -16 64 0t64 0 64 0 36 0" {...line(SKY, 8)} />
      <path d="M540 668q32 -16 64 0t60 0" {...line(SKY, 8)} />
      <path d="M214 698q30 -14 60 0t60 0" {...line(SKY, 6)} strokeOpacity=".6" />
      <path d="M172 208H332M172 190V226M332 190V226" {...line(YEL, 5)} />
      <path d="M155 232V368M138 232H172M138 368H172" {...line(YEL, 5)} />
    </g>
  )
}

function Biomec() {
  const hex = 'M322 384H480L528 492L478 602H322L275 492Z'
  return (
    <>
      <path d="M135 436H240L262 400L284 470L302 372L316 440" {...line(YEL, 9)} />
      <path d="M486 440L498 404L512 468L535 366L553 458L566 436H666" {...line(YEL, 9)} />
      <path d="M398 384V300" {...line(WHITE, 11)} />
      <path d="M396 322C330 322 282 290 268 230C330 224 386 256 396 322Z" {...solid(mix('var(--puj-blue)', 70, 'white'), WHITE, 11)} fillOpacity=".22" />
      <path d="M284 244L384 306" {...line(SKY, 4)} />
      <path d="M402 296C410 240 470 190 555 178C562 238 500 288 402 296Z" {...solid(mix('var(--puj-blue)', 70, 'white'), WHITE, 11)} fillOpacity=".22" />
      <path d="M420 280L542 196" {...line(SKY, 4)} />
      {[[457, 258], [480, 240], [502, 227]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="5" fill={SKY} />
      ))}
      <path d="M548 228H598V268M618 214V286H592" {...line(YEL, 6)} />
      <circle cx="596" cy="270" r="9" {...line(YEL, 5)} />
      <circle cx="618" cy="208" r="8" {...line(YEL, 5)} />
      <circle cx="548" cy="172" r="6" {...line(YEL, 4)} />
      <path d="M185 252H252M185 238V266M252 238V266" {...line(SKY, 4)} />
      <path d={hex} {...solid(FILL, WHITE, 14)} />
      <circle cx="402" cy="492" r="78" {...solid(mix('var(--puj-blue)', 62, 'black'), WHITE, 8)} />
      <Gear cx={376} cy={474} r={40} teeth={10} stroke={YEL} w={7} />
      <Gear cx={432} cy={518} r={30} teeth={9} stroke={SKY} w={6} />
    </>
  )
}

function Tronicas() {
  const pins = [338, 364, 438, 464]
  const node = (x: number, y: number, c: string, r = 11, w = 5) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={FILL} stroke={c} strokeWidth={w} />
  return (
    <>
      <Gear cx={272} cy={285} r={78} teeth={11} stroke={SKY} w={8} fill={mix('var(--puj-blue)', 90, 'black')} />
      <Gear cx={530} cy={528} r={74} teeth={11} stroke={SKY} w={8} fill={mix('var(--puj-blue)', 90, 'black')} />
      {/* yellow traces */}
      <g {...line(YEL, 6)}>
        <path d="M356 300V252L336 214" />
        <path d="M443 300V252L474 214" />
        <path d="M298 354H244L200 388" />
        <path d="M298 446H240" />
        <path d="M503 354H574" />
        <path d="M503 448H580L602 418" />
        <path d="M356 503V556L376 598" />
        <path d="M444 503V556L424 594" />
      </g>
      {[[332, 207], [481, 207], [195, 390], [232, 446], [580, 354], [605, 412], [378, 605], [423, 595]].map(([x, y]) => node(x, y, YEL, 9, 5))}
      {/* white traces */}
      <g {...line(WHITE, 8)}>
        <path d="M400 300V170M400 502V630M298 400H170M502 400H632" />
      </g>
      {[[400, 163], [400, 636], [163, 400], [637, 400]].map(([x, y]) => node(x, y, WHITE, 10, 6))}
      {/* the chip */}
      {pins.map((p) => (
        <g key={p} {...line(WHITE, 9)}>
          <path d={`M${p} 300V272M${p} 502V530M300 ${p}H272M502 ${p}H530`} />
        </g>
      ))}
      <rect x="298" y="298" width="205" height="205" rx="16" {...solid(NAVY, WHITE, 13)} />
      <rect x="306" y="306" width="189" height="189" rx="10" fill={FILL} />
      <rect x="336" y="336" width="130" height="130" rx="14" {...line(YEL, 8)} />
      <rect x="380" y="380" width="42" height="42" rx="3" fill={YEL} fillOpacity=".85" />
      <g {...line(YEL, 5)}>
        <path d="M391 352V380M411 352V380M391 422V450M411 422V450M352 391H380M352 411H380M422 391H450M422 411H450" />
      </g>
      <circle cx="486" cy="318" r="5" fill={WHITE} />
      {/* the robot arms (the second is the first one turned half a turn) */}
      {[0, 180].map((a) => (
        <g key={a} transform={`rotate(${a} 400 400)`} {...line(WHITE, 9)}>
          <path d="M503 302L548 252" />
          <circle cx="558" cy="241" r="13" fill={FILL} />
          <path d="M570 252L622 286L650 318M606 328L652 304" />
        </g>
      ))}
    </>
  )
}

// The generic medal: an open book under a rising sun, between two laurel branches. For the other career of a double program that has no engineering medal.
function General() {
  const rays = Array.from({ length: 9 }, (_, i) => {
    const a = rad(-170 + i * 20)
    return <path key={i} d={`M${(400 + 78 * Math.cos(a)).toFixed(1)} ${(300 + 78 * Math.sin(a)).toFixed(1)}L${(400 + 124 * Math.cos(a)).toFixed(1)} ${(300 + 124 * Math.sin(a)).toFixed(1)}`} {...line(YEL, 11)} />
  })
  const leaves = Array.from({ length: 7 }, (_, i) => {
    const a = 112 + i * 21
    const x = 400 + 292 * Math.cos(rad(a))
    const y = 400 + 292 * Math.sin(rad(a))
    return (
      <g key={i}>
        <ellipse cx={x.toFixed(1)} cy={y.toFixed(1)} rx="34" ry="14" transform={`rotate(${a + 90} ${x.toFixed(1)} ${y.toFixed(1)})`} fill={i % 3 === 2 ? YEL : GREEN} fillOpacity=".92" />
        <ellipse cx={(800 - x).toFixed(1)} cy={y.toFixed(1)} rx="34" ry="14" transform={`rotate(${-(a + 90)} ${(800 - x).toFixed(1)} ${y.toFixed(1)})`} fill={i % 3 === 2 ? YEL : GREEN} fillOpacity=".92" />
      </g>
    )
  })
  return (
    <>
      {leaves}
      <path d="M400 300m-46 0a46 46 0 0 1 92 0Z" fill={YEL} />
      <g>{rays}</g>
      <path d="M400 478C352 440 280 432 214 446L214 596C280 584 352 592 400 630Z" {...solid(FILL, WHITE, 12)} />
      <path d="M400 478C448 440 520 432 586 446L586 596C520 584 448 592 400 630Z" {...solid(FILL, WHITE, 12)} />
      <path d="M400 478V630" {...line(WHITE, 9)} />
      {[0, 1, 2].map((i) => (
        <g key={i} {...line(SKY, 6)} strokeOpacity=".8">
          <path d={`M246 ${478 + i * 30}C290 ${470 + i * 30} 340 ${478 + i * 30} 372 ${504 + i * 30}`} />
          <path d={`M554 ${478 + i * 30}C510 ${470 + i * 30} 460 ${478 + i * 30} 428 ${504 + i * 30}`} />
        </g>
      ))}
    </>
  )
}

// Every drawing is centred in the disc by the middle of its own bounding box (measured, not guessed), so the five medals look balanced.
const centred = (dx: number, dy: number, node: ReactNode) => <g transform={`translate(${dx} ${dy})`}>{node}</g>

export const EMBLEM: Record<MedalKey, () => ReactNode> = {
  sistemas: () => centred(19, 21, <Sistemas />),
  industrial: () => centred(-8, -10, <Industrial />),
  civil: () => centred(0, -22, <Civil />),
  biomec: () => centred(0, 16, <Biomec />),
  tronicas: () => <Tronicas />,
  general: () => <General />,
}
