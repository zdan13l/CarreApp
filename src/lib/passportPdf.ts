// The passport as a PDF keepsake. The pages are drawn as SVG (the same components of the screen, rendered to markup, so the stamps are the
// same ones), the browser turns each page into a picture and lib/pdf.ts puts the pictures in a PDF. It all happens on the phone: nothing is
// uploaded. The colours here are fixed and light (the paper of the passport), whatever theme the phone is in; that is why they are
// written out instead of read from the CSS variables.
// The pages are the ones of the booklet of the screen: the cover and the identity page are general (no theme, no committee, no role);
// every induction has its own pages (the induction, the committee, the visas) in its own theme; blank pages wait at the end.
import { createElement, type ReactElement } from 'react'
import { airportCode } from './flight'
import { committeeOf } from './committees'
import { personNumber, PASSPORT_ROLE_LONG } from './passports'
import { jpegPdf } from './pdf'
import { mrzText, stampLook, stampTime } from './stamp'
import { photoUrl } from './storage'
import { symbolOf } from './symbols'
import { cultureOf, themeOf } from './themes'
import CareerEmblem, { careerKey } from '../components/CareerEmblem'
import CommitteeSeal from '../components/CommitteeSeal'
import CultureEmblem, { CultureOrnament } from '../components/CultureEmblem'
import {
  committeeWords,
  contextOf,
  photoSealOf,
  STAMP_WORD,
  visaSlotsOf,
  type MemberPassportData,
  type MemberRecord,
  type VisaSlot,
} from '../components/MemberPassport'
import { CultureSeal, PhotoSeal, TextSeal } from '../components/Seals'
import Stamp from '../components/Stamp'

export const PAGE_W = 600
export const PAGE_H = 840
const PER_PAGE_PDF = 6 // visas per page of the PDF (two columns, three rows)
const MIN_VISA_PAGES_PDF = 2
const BLANK_PAGES_PDF = 2

const PAPER = '#fafbfd'
const INK = '#0c1740'
const MUTED = '#404c78'
const FAINT = '#525e88'
const LINE = '#8e9bc0'
const INKS = ['', '#1f49b8', '#b3261e', '#1b7a52', '#6a3fa0', '#a85a00']
const NAVY = ['#234bb5', '#0c1c55']
const GOLD = '#ffc53d'
const FOIL = ['#a47c28', '#f7de8f', '#b98b30', '#f4d575']

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---------- turning the components into pieces of SVG ----------

/** The first <svg> of some markup, with everything inside it (nested svgs included). */
export function svgOf(html: string): string {
  const start = html.indexOf('<svg')
  if (start < 0) return ''
  const re = /<svg\b|<\/svg>/g
  re.lastIndex = start
  let depth = 0
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[0] === '</svg>') {
      depth--
      if (depth === 0) return html.slice(start, m.index + 6)
    } else depth++
  }
  return html.slice(start)
}

/** Puts an svg at a place of the page and with a size, and makes its ids its own (two pieces can be rendered with the same ids). */
export function place(svg: string, n: number, x: number, y: number, w: number, h: number): string {
  const unique = svg
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="p${n}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#p${n}-${id})`)
    .replace(/href="#([^"]+)"/g, (_, id) => `href="#p${n}-${id}"`)
  return unique.replace(/^<svg([^>]*)>/, (_, attrs: string) => `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, '').replace(/\sstyle="[^"]*"/g, '')} x="${x}" y="${y}" width="${w}" height="${h}" overflow="visible">`)
}

type Render = (element: ReactElement) => string

export interface PdfAssets {
  photo: string | null // the picture of the person as a data URL
  photos?: Record<string, string> // the photos of groups and bases (by storage path) as data URLs
  font: string // the data URL of the font
}

function css(font: string): string {
  const inks = INKS.map((c, i) => (i ? `--ink-${i}:${c};` : '')).join('')
  return `
@font-face{font-family:'Archivo Variable';src:url(${font}) format('woff2');font-weight:100 900;font-stretch:62% 125%}
svg{${inks}--seal-paper:${PAPER};--emblem-paper:${PAPER};--stamp-paper:${PAPER};--surface:${PAPER};--foil-a:${FOIL[0]};--foil-b:${FOIL[1]};--foil-c:${FOIL[2]};--foil-d:${FOIL[3]}}
text{font-family:'Archivo Variable',Helvetica,Arial,sans-serif}
.sans,.stamp-text,.stamp-initial{font-family:'Archivo Variable',Helvetica,Arial,sans-serif;font-stretch:76%}
.mono,.stamp-mono{font-family:ui-monospace,Menlo,Consolas,'Courier New',monospace}
.emblem .f,.ornament .f{fill:currentColor;stroke:none}.emblem .o,.ornament .o{fill:none;stroke:currentColor}
.emblem .pp{fill:var(--emblem-paper);stroke:none}.emblem .ps{fill:none;stroke:var(--emblem-paper)}
.seal-ink{fill:currentColor;stroke:currentColor}.seal-ink text{fill:currentColor;stroke:none}
.seal-emblem .f{fill:currentColor;stroke:none}.seal-emblem .o{fill:none;stroke:currentColor}
.seal-emblem .pp{fill:var(--seal-paper);stroke:none}.seal-emblem .ps{fill:none;stroke:var(--seal-paper)}
.stamp-ink{stroke:var(--stamp-ink);fill:var(--stamp-ink)}.stamp-onink{fill:var(--stamp-paper);stroke:none}
.stamp-empty{stroke:var(--stamp-ink);fill:none}
${INKS.map((c, i) => (i ? `.committee-seal.ink-${i}{color:${c}}` : '')).join('')}`
}

// ---------- small drawing helpers ----------

interface TextOpts {
  size?: number
  weight?: number
  fill?: string
  anchor?: 'start' | 'middle' | 'end'
  mono?: boolean
  spacing?: number
  stretch?: boolean
  italic?: boolean
}
const text = (x: number, y: number, s: string, o: TextOpts = {}) =>
  `<text x="${x}" y="${y}" font-size="${o.size ?? 12}" font-weight="${o.weight ?? 700}" fill="${o.fill ?? INK}" text-anchor="${o.anchor ?? 'start'}" letter-spacing="${o.spacing ?? 0}" class="${o.mono ? 'mono' : o.stretch ? 'sans' : ''}"${o.italic ? ' font-style="italic"' : ''}>${esc(s)}</text>`

/** Breaks a text into lines of at most `max` characters (by words). */
export function wrap(s: string, max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of s.split(/\s+/).filter(Boolean)) {
    if (line && (line + ' ' + word).length > max) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  return lines
}

const lines = (x: number, y: number, rows: string[], step: number, o: TextOpts) => rows.map((r, i) => text(x, y + i * step, r, o)).join('')

function frame(inner: string, defs = '', background = PAPER): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}"><defs>${defs}</defs><rect width="${PAGE_W}" height="${PAGE_H}" fill="${background}"/>${inner}</svg>`
}

const foilDefs = `<linearGradient id="foil" x1="0" y1="0" x2="1" y2="0.35">${FOIL.map((c, i) => `<stop offset="${[0, 0.36, 0.58, 1][i]}" stop-color="${c}"/>`).join('')}</linearGradient>`

export interface PageContext {
  data: MemberPassportData
  assets: PdfAssets
  render: Render
}

function pieces(ctx: PageContext) {
  let n = 0
  const piece = (el: ReactElement, x: number, y: number, w: number, h = w, tilt = 0, color?: string, paper?: string) => {
    const svg = place(svgOf(ctx.render(el)), ++n, x, y, w, h)
    const style = `${color ? `color:${color};` : ''}${paper ? `--emblem-paper:${paper};--seal-paper:${paper};` : ''}`
    return `<g${style ? ` style="${style}"` : ''}${tilt ? ` transform="rotate(${tilt} ${x + w / 2} ${y + h / 2})"` : ''}>${svg}</g>`
  }
  return { piece }
}

// ---------- the pages ----------

function cover(ctx: PageContext): string {
  const { person, records } = ctx.data
  const career = records[0]?.career ?? ''
  const { piece } = pieces(ctx)
  const name = wrap(person.full_name.toUpperCase(), 22)
  const defs = `<linearGradient id="navy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${NAVY[0]}"/><stop offset="1" stop-color="${NAVY[1]}"/></linearGradient>${foilDefs}`
  const corner = (x: number, y: number, dx: number, dy: number) => `<path d="M${x} ${y + dy * 26}V${y}H${x + dx * 26}" fill="none" stroke="${GOLD}" stroke-width="2.4" opacity=".85"/>`
  const chip = 674 + (name.length - 1) * 38 + 22
  return frame(
    `<rect width="${PAGE_W}" height="${PAGE_H}" fill="url(#navy)"/>
    <rect x="22" y="22" width="556" height="796" fill="none" stroke="url(#foil)" stroke-width="2.6"/>
    <rect x="31" y="31" width="538" height="778" fill="none" stroke="url(#foil)" stroke-width="1" opacity=".7"/>
    ${corner(44, 44, 1, 1)}${corner(556, 44, -1, 1)}${corner(44, 796, 1, -1)}${corner(556, 796, -1, -1)}
    ${text(300, 96, 'PONTIFICIA UNIVERSIDAD JAVERIANA', { size: 11.5, mono: true, spacing: 3.2, fill: '#c9d6ff', anchor: 'middle' })}
    ${piece(createElement(CareerEmblem, { career, size: 100 }), 150, 140, 300, 300, 0, GOLD, NAVY[1])}
    ${text(300, 540, 'PASAPORTE', { size: 86, weight: 800, fill: 'url(#foil)', anchor: 'middle', stretch: true, spacing: 2 })}
    <path d="M150 566H275M325 566H450" stroke="${GOLD}" stroke-width="1.2" opacity=".7"/><path d="M300 558l2.6 5.2 5.8.8-4.2 4 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4 5.8-.8z" fill="${GOLD}"/>
    ${text(300, 612, 'INDUCCIÓN JAVERIANA', { size: 14, mono: true, spacing: 4.4, fill: '#c9d6ff', anchor: 'middle' })}
    ${lines(300, 674, name, 38, { size: 33, weight: 800, fill: '#ffffff', anchor: 'middle', stretch: true })}
    <rect x="${300 - 130}" y="${chip}" width="260" height="30" rx="7" fill="none" stroke="${GOLD}" stroke-opacity=".5"/>
    ${text(300, chip + 20, career.toUpperCase().slice(0, 34), { size: 12, mono: true, spacing: 2, fill: GOLD, anchor: 'middle' })}`,
    defs,
    NAVY[1],
  )
}

interface PageLook {
  culture: string // the ornament and the ink of the page ('general' for the pages that belong to no induction)
  mrz: [string, string]
}

function footer(look: PageLook, no: number, total: number): string {
  return `${text(300, 782, look.mrz[0], { size: 11, mono: true, spacing: 3.4, fill: FAINT, anchor: 'middle' })}${text(300, 797, look.mrz[1], { size: 11, mono: true, spacing: 3.4, fill: FAINT, anchor: 'middle' })}${text(300, 826, `${no} / ${total}`, { size: 10, mono: true, spacing: 3, fill: FAINT, anchor: 'middle' })}`
}

function page(ctx: PageContext, look: PageLook, body: string, no: number, total: number, ink: string): string {
  const { piece } = pieces(ctx)
  const strip = (y: number) => piece(createElement(CultureOrnament, { culture: look.culture as never, height: 14 }), 36, y, 528, 14, 0, ink)
  return frame(`<rect x="20" y="20" width="560" height="800" fill="none" stroke="${LINE}" stroke-width="1.6" rx="6"/>${strip(34)}${strip(802)}${body}${footer(look, no, total)}`)
}

const mrzOf = (name: string, second: string): [string, string] => [`P<PUJ<<${mrzText(name, 23)}`, second.padEnd(30, '<').slice(0, 30)]

function identity(ctx: PageContext, no: number, total: number): string {
  const { person, records } = ctx.data
  const career = records[0]?.career ?? ''
  const ink = INKS[1]
  const { piece } = pieces(ctx)
  const symbol = symbolOf(person.symbol)
  const SymbolIcon = symbol?.Icon
  const nameLines = wrap(person.full_name.toUpperCase(), 24)
  const generation = person.generation?.trim()
  const joined = person.joined_term?.trim()
  const rows: [string, string][] = [
    ['CARRERA', career || '—'],
    ['INGRESÓ A INDUCCIÓN', joined || 'Por definir'],
    ['GENERACIÓN', generation || 'Por definir'],
    ['USUARIO', `@${person.username}`],
    ['NÚMERO', personNumber(person.id)],
  ]
  const grid = rows
    .map(([k, v], i) => {
      const wide = i === 0
      const col = wide ? 0 : (i - 1) % 2
      const row = wide ? 0 : 1 + Math.floor((i - 1) / 2)
      const x = 56 + col * 258
      const y = 408 + row * 54
      return `${text(x, y, k, { size: 9.5, mono: true, spacing: 2, fill: FAINT })}${lines(x, y + 19, wrap(v, wide ? 50 : 26).slice(0, 2), 17, { size: 15, weight: 800, mono: k === 'USUARIO' || k === 'NÚMERO', fill: INK })}`
    })
    .join('')
  const photo = ctx.assets.photo
    ? `<clipPath id="ph"><rect x="56" y="160" width="150" height="190" rx="14"/></clipPath><image href="${ctx.assets.photo}" x="56" y="160" width="150" height="190" preserveAspectRatio="xMidYMid slice" clip-path="url(#ph)"/>`
    : `<rect x="56" y="160" width="150" height="190" rx="14" fill="#dfe5f1"/>${text(131, 275, (person.full_name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('') || '?').toUpperCase(), { size: 58, weight: 800, fill: MUTED, anchor: 'middle', stretch: true })}`
  const slot = (x: number, label: string, value: string | undefined, top: string, bottom: string, tilt: number) =>
    `${value ? piece(createElement(TextSeal, { center: value, top, bottom, size: 150, tilt: 0 }), x, 566, 150, 150, tilt, ink, PAPER) : `<circle cx="${x + 75}" cy="641" r="72" fill="none" stroke="${LINE}" stroke-width="2" stroke-dasharray="6 6"/>${text(x + 75, 646, label.toUpperCase(), { size: 12, mono: true, spacing: 2, fill: FAINT, anchor: 'middle' })}`}${text(x + 75, 736, label, { size: 14, weight: 800, anchor: 'middle', stretch: true })}${text(x + 75, 752, (value ?? 'Por definir').toUpperCase().slice(0, 22), { size: 9.5, mono: true, spacing: 1.6, fill: FAINT, anchor: 'middle' })}`
  const body = `
    ${piece(createElement(CareerEmblem, { career, size: 64 }), 52, 62, 70, 70, 0, ink)}
    ${text(136, 82, 'DOCUMENTO DE IDENTIDAD · INDUCCIÓN', { size: 11, mono: true, spacing: 2.4, fill: FAINT })}
    ${lines(136, 112, nameLines.slice(0, 2), 30, { size: 26, weight: 800, stretch: true })}
    <path d="M56 140H544" stroke="${LINE}" stroke-dasharray="3 4"/>
    ${photo}<rect x="56" y="160" width="150" height="190" rx="14" fill="none" stroke="${ink}" stroke-width="4"/>
    ${text(242, 184, 'APODO', { size: 10, mono: true, spacing: 2.4, fill: FAINT })}
    ${person.nickname?.trim() ? lines(242, 222, wrap(`«${person.nickname.trim()}»`, 15).slice(0, 2), 36, { size: 34, weight: 800, fill: ink, stretch: true }) : text(242, 216, 'Sin apodo', { size: 20, fill: FAINT })}
    <circle cx="272" cy="300" r="30" fill="#eef1f8" stroke="${ink}" stroke-width="2.4"/>
    ${SymbolIcon ? `<g style="color:${ink}">${place(svgOf(ctx.render(createElement(SymbolIcon, { size: 30, strokeWidth: 1.8 }))), 99, 257, 285, 30, 30)}</g>` : text(272, 308, '?', { size: 24, fill: FAINT, anchor: 'middle' })}
    ${text(318, 304, symbol ? person.symbol_label?.trim() || symbol.name : 'Sin símbolo', { size: 15, fill: MUTED })}
    ${grid}
    ${slot(86, 'Generación', generation, 'Generación', 'Inducción Javeriana', -3)}${slot(364, 'Ingresó a inducción', joined, 'Ingresó a inducción', 'Pontificia Universidad Javeriana', 4)}`
  return page(ctx, { culture: 'general', mrz: mrzOf(person.full_name, `PUJ<<${careerKey(career).toUpperCase()}<<${personNumber(person.id).slice(4)}`) }, body, no, total, ink)
}

function look(ctx: PageContext, record: MemberRecord): PageLook & { ink: string } {
  const culture = cultureOf(record.term.theme, record.culture)
  return {
    culture: culture.key,
    ink: INKS[culture.ink],
    mrz: mrzOf(ctx.data.person.full_name, `${mrzText(record.term.name, 8).replace(/<+$/, '')}<<${mrzText(themeOf(record.term.theme).name, 10).replace(/<+$/, '')}`),
  }
}

function induction(ctx: PageContext, record: MemberRecord, no: number, total: number): string {
  const theme = themeOf(record.term.theme)
  const culture = cultureOf(record.term.theme, record.culture)
  const l = look(ctx, record)
  const c = contextOf(ctx.data, record)
  const { piece } = pieces(ctx)
  const welcome = record.term.welcome?.trim()
  const facts: [string, string][] = [
    ['PAPEL', PASSPORT_ROLE_LONG[record.role]],
    ['CARRERA', record.career],
    ...(record.role === 'runner' ? ([['GRUPO', c?.team_name ?? 'Sin grupo todavía'], ['CON QUIÉN CORRES', c?.partners?.length ? c.partners.join(' y ') : c?.team_name ? 'Todavía nadie más' : '—']] as [string, string][]) : []),
    ...(record.role === 'base' ? ([['BASE', c?.base_name ?? 'Sin base todavía']] as [string, string][]) : []),
  ]
  const grid = facts.map(([k, v], i) => `${text(56 + (i % 2) * 258, 590 + Math.floor(i / 2) * 54, k, { size: 9.5, mono: true, spacing: 2, fill: FAINT })}${lines(56 + (i % 2) * 258, 609 + Math.floor(i / 2) * 54, wrap(v, 26).slice(0, 2), 17, { size: 15, weight: 800 })}`).join('')
  const body = `
    ${piece(createElement(CultureEmblem, { culture: culture.key, size: 64 }), 52, 62, 70, 70, 0, l.ink)}
    ${text(136, 82, `INDUCCIÓN ${record.term.name}`.toUpperCase(), { size: 12, mono: true, spacing: 3, fill: FAINT })}
    ${lines(136, 116, wrap(`Temática ${theme.name}`, 20).slice(0, 2), 34, { size: 34, weight: 800, fill: l.ink, stretch: true })}
    <path d="M56 148H544" stroke="${LINE}" stroke-dasharray="3 4"/>
    ${text(56, 182, 'PALABRAS DE TUS COORDINADORES', { size: 10, mono: true, spacing: 2.4, fill: FAINT })}
    ${welcome ? lines(56, 210, wrap(welcome, 62).slice(0, 9), 20, { size: 14, fill: INK }) : text(56, 210, 'Tus coordinadores te dejarán aquí unas palabras.', { size: 14, italic: true, fill: FAINT })}
    ${piece(createElement(CultureSeal, { culture: culture.key, theme: record.term.theme, top: `Cultura ${culture.name}`, bottom: `Te tocó · ${record.term.name}`, size: 170, tilt: 0 }), 56, 400, 170, 170, -4, l.ink, PAPER)}
    ${text(250, 440, 'TE TOCÓ', { size: 10, mono: true, spacing: 2.4, fill: FAINT })}${text(250, 482, culture.name, { size: 36, weight: 800, fill: l.ink, stretch: true })}${lines(250, 508, wrap(`${culture.myth}.`, 30), 17, { size: 13, fill: MUTED })}
    ${grid}`
  return page(ctx, l, body, no, total, l.ink)
}

function committeePage(ctx: PageContext, record: MemberRecord, no: number, total: number): string {
  const committee = committeeOf(record.committee)
  const l = look(ctx, record)
  const c = contextOf(ctx.data, record)
  const { piece } = pieces(ctx)
  const words = committeeWords(ctx.data, record)
  const photo = photoSealOf(record, c)
  const body = `
    ${text(56, 82, `TU COMITÉ · ${record.term.name}`.toUpperCase(), { size: 12, mono: true, spacing: 3, fill: FAINT })}
    ${text(56, 124, committee ? committee.name : 'Sin comité todavía', { size: 40, weight: 800, fill: l.ink, stretch: true })}
    ${record.committee_lead ? `<rect x="400" y="96" width="144" height="26" rx="6" fill="#f4d575"/>${text(472, 114, 'COORDINADOR', { size: 11, mono: true, spacing: 2, fill: '#1a1200', anchor: 'middle' })}` : ''}
    <path d="M56 148H544" stroke="${LINE}" stroke-dasharray="3 4"/>
    ${committee ? piece(createElement(CommitteeSeal, { committee: committee.key, lead: Boolean(record.committee_lead), size: 220 }), 56, 172, 220, 220, -4, undefined, PAPER) : `<circle cx="166" cy="282" r="100" fill="none" stroke="${LINE}" stroke-width="2" stroke-dasharray="6 6"/>${text(166, 288, 'COMITÉ', { size: 15, mono: true, spacing: 2, fill: FAINT, anchor: 'middle' })}`}
    ${committee ? lines(310, 250, wrap(committee.tagline, 18), 34, { size: 30, weight: 800, fill: l.ink, stretch: true }) : ''}
    ${committee ? lines(310, 330, wrap(committee.myth, 34), 17, { size: 13, italic: true, fill: MUTED }) : ''}
    ${text(56, 436, (committee ? `PALABRAS DEL COMITÉ ${committee.name}` : 'PALABRAS DE TU COMITÉ').toUpperCase(), { size: 10, mono: true, spacing: 2.4, fill: FAINT })}
    ${words ? lines(56, 464, wrap(words, 62).slice(0, 7), 20, { size: 14 }) : text(56, 464, committee ? 'Tu comité te dejará aquí unas palabras.' : 'Cuando te asignen un comité, aquí estarán sus palabras.', { size: 14, italic: true, fill: FAINT })}
    ${photo ? `${piece(createElement(PhotoSeal, { url: photo.path ? (ctx.assets.photos?.[photo.path] ?? null) : null, top: photo.top, bottom: photo.bottom, size: 150, tilt: 0 }), 56, 600, 150, 150, 3)}${text(236, 650, photo.top.toUpperCase(), { size: 10, mono: true, spacing: 2.4, fill: FAINT })}${text(236, 690, photo.bottom.slice(0, 22), { size: 30, weight: 800, fill: '#a47c28', stretch: true })}${text(236, 714, record.role === 'runner' ? 'El grupo con el que corres.' : 'Tú no corres: tu sello es tu base.', { size: 13, fill: MUTED })}` : ''}`
  return page(ctx, l, body, no, total, l.ink)
}

function visaPageSvg(ctx: PageContext, record: MemberRecord, index: number, slots: VisaSlot[], no: number, total: number): string {
  const l = look(ctx, record)
  const theme = themeOf(record.term.theme)
  const { piece } = pieces(ctx)
  const cells = Array.from({ length: PER_PAGE_PDF }, (_, i) => {
    const slot = slots[i]
    const x = 85 + (i % 2) * 235
    const y = 128 + Math.floor(i / 2) * 215
    if (!slot) return `<circle cx="${x + 75}" cy="${y + 75}" r="72" fill="none" stroke="${LINE}" stroke-width="1.6" stroke-dasharray="5 6" opacity=".55"/>`
    if (slot.kind === 'stamp') {
      const s = slot.stamp
      const lk = stampLook(s.base_key ?? s.base_name ?? '')
      const stamp = piece(createElement(Stamp, { seed: s.base_key ?? s.base_name ?? '', name: s.base_name ?? '', round: s.round_number, time: stampTime(s.stamped_at), state: 'done', size: 150, straight: true }), x, y, 150, 150, lk.tilt, `var(--ink-${lk.ink})`)
      return `<g style="--stamp-ink:var(--ink-${lk.ink})">${stamp}</g>${text(x + 75, y + 172, s.base_name ?? '', { size: 14, weight: 800, anchor: 'middle', stretch: true })}${text(x + 75, y + 188, record.role === 'base' ? `RONDA ${s.round_number}` : `${airportCode(s.base_name ?? '')} · R${s.round_number}`, { size: 9.5, mono: true, spacing: 1.6, fill: FAINT, anchor: 'middle' })}`
    }
    const top = slot.kind === 'entry' ? 'Visado de entrada' : 'Carrera coordinada'
    const bottom = slot.kind === 'entry' ? `${slot.term} · ${theme.name}` : slot.event
    return `${piece(createElement(CultureSeal, { culture: slot.culture, theme: slot.theme, top, bottom, size: 150, tilt: 0 }), x, y, 150, 150, i % 2 ? 4 : -5, l.ink, PAPER)}${text(x + 75, y + 172, slot.kind === 'entry' ? 'Visado de entrada' : slot.event, { size: 14, weight: 800, anchor: 'middle', stretch: true })}${text(x + 75, y + 188, slot.kind === 'entry' ? 'BIENVENIDA' : 'COORDINADA', { size: 9.5, mono: true, spacing: 1.6, fill: FAINT, anchor: 'middle' })}`
  }).join('')
  const earned = visaSlotsOf(record, ctx.data.stamps, ctx.data.records).filter((s) => s.kind !== 'entry').length
  const word = STAMP_WORD[record.role]
  return page(ctx, l, `${text(56, 96, `VISADOS · ${record.term.name} · PÁGINA ${index + 1}`, { size: 11, mono: true, spacing: 2.4, fill: FAINT })}${text(544, 96, `${earned} ${earned === 1 ? word.one : word.many}`.toUpperCase(), { size: 10, mono: true, spacing: 1.6, fill: l.ink, anchor: 'end' })}<g style="color:${l.ink}">${cells}</g>${index === 0 && earned === 0 ? text(300, 752, 'Las páginas en blanco se llenan con el tiempo.', { size: 12, italic: true, fill: MUTED, anchor: 'middle' }) : ''}`, no, total, l.ink)
}

function blankPage(ctx: PageContext, n: number, no: number, total: number): string {
  const { person } = ctx.data
  const body = n === 0 ? text(300, 420, 'PÁGINAS PARA TUS PRÓXIMAS INDUCCIONES', { size: 12, mono: true, spacing: 3, fill: FAINT, anchor: 'middle' }) : ''
  return frame(`<rect x="20" y="20" width="560" height="800" fill="none" stroke="${LINE}" stroke-width="1.6" rx="6" opacity=".7"/>${body}${text(300, 826, `${no} / ${total}`, { size: 10, mono: true, spacing: 3, fill: FAINT, anchor: 'middle' })}<title>${esc(person.full_name)}</title>`)
}

/** Every page of the passport as an SVG document (before it becomes a picture). */
export function passportPageSvgs(ctx: PageContext): string[] {
  const { records, stamps } = ctx.data
  const visaCount = (r: MemberRecord) => Math.max(MIN_VISA_PAGES_PDF, Math.ceil(visaSlotsOf(r, stamps, records).length / PER_PAGE_PDF))
  const total = 2 + records.reduce((n, r) => n + 2 + visaCount(r), 0) + BLANK_PAGES_PDF
  const svgs = [cover(ctx), identity(ctx, 2, total)]
  let no = 3
  for (const r of records) {
    svgs.push(induction(ctx, r, no++, total), committeePage(ctx, r, no++, total))
    const slots = visaSlotsOf(r, stamps, records)
    for (let i = 0; i < visaCount(r); i++) svgs.push(visaPageSvg(ctx, r, i, slots.slice(i * PER_PAGE_PDF, (i + 1) * PER_PAGE_PDF), no++, total))
  }
  for (let n = 0; n < BLANK_PAGES_PDF; n++) svgs.push(blankPage(ctx, n, no++, total))
  const style = `<style>${css(ctx.assets.font)}</style>`
  return svgs.map((s) => s.replace(/<defs>/, `<defs>${style}`))
}

// ---------- the browser side: pictures and the file ----------

async function svgToJpeg(svg: string, scale: number): Promise<Uint8Array> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('No se pudo dibujar una página.'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(PAGE_W * scale)
    canvas.height = Math.round(PAGE_H * scale)
    const g = canvas.getContext('2d')
    if (!g) throw new Error('Este teléfono no puede armar el PDF.')
    g.fillStyle = PAPER
    g.fillRect(0, 0, canvas.width, canvas.height)
    g.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) throw new Error('No se pudo armar el PDF.')
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function dataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null // no picture (or no network): the page shows the initials
  }
}

/** The photos the pages need (the person, their groups and bases) as data URLs: an SVG drawn as a picture cannot load them itself. */
async function loadPhotos(data: MemberPassportData): Promise<{ photo: string | null; photos: Record<string, string> }> {
  const url = photoUrl(data.person.photo_path)
  const photo = url ? await dataUrl(url) : null
  const photos: Record<string, string> = {}
  for (const r of data.records) {
    const seal = photoSealOf(r, contextOf(data, r))
    const href = seal?.path ? photoUrl(seal.path) : null
    if (seal?.path && href && !photos[seal.path]) {
      const d = await dataUrl(href)
      if (d) photos[seal.path] = d
    }
  }
  return { photo, photos }
}

/** The passport as a PDF (A5, one page per page of the booklet). */
export async function buildPassportPdf(data: MemberPassportData, scale = 2.2): Promise<Blob> {
  const [{ renderToStaticMarkup }, fontModule, photos] = await Promise.all([
    import('react-dom/server'),
    import('@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2?inline'),
    loadPhotos(data),
  ])
  const svgs = passportPageSvgs({ data, assets: { ...photos, font: fontModule.default }, render: (el) => renderToStaticMarkup(el) })
  const pages = []
  for (const svg of svgs) pages.push({ jpeg: await svgToJpeg(svg, scale), width: Math.round(PAGE_W * scale), height: Math.round(PAGE_H * scale) })
  const bytes = jpegPdf(pages, { width: 420, height: 588, title: `Pasaporte de ${data.person.full_name}` })
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
}

/** Builds the PDF and hands it over: the share sheet on a phone (to save it in Files), a download on a computer. */
export async function downloadPassportPdf(data: MemberPassportData): Promise<void> {
  const blob = await buildPassportPdf(data)
  const file = new File([blob], `pasaporte-${data.person.username}.pdf`, { type: 'application/pdf' })
  const phone = window.matchMedia?.('(pointer: coarse)').matches
  if (phone && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Mi pasaporte de CarreApp' })
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // they closed the sheet
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 8000)
}
