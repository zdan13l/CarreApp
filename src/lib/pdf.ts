// A minimal PDF writer: one page per JPEG image (the passport pages drawn as pictures). No library needed for that: a PDF is a
// handful of objects (catalog, pages, and per page: the page, its content that paints the image, the image itself) and a table with
// the byte position of each one. Used by the passport keepsake (lib/passportPdf.ts).
const enc = new TextEncoder()

export interface PdfPage {
  jpeg: Uint8Array
  width: number // pixels of the picture
  height: number
}

/** PDF strings are ASCII here: no accents (they are removed) and the three characters that mean something are escaped. */
const pdfText = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/([\\()])/g, '\\$1')

/** The PDF of the pictures, each filling a page of `width` x `height` points (A5 is 420 x 595). */
export function jpegPdf(pages: PdfPage[], { width, height, title }: { width: number; height: number; title: string }): Uint8Array {
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (data: string | Uint8Array) => {
    const bytes = typeof data === 'string' ? enc.encode(data) : data
    parts.push(bytes)
    length += bytes.length
  }
  const begin = (n: number) => {
    offsets[n] = length
    push(`${n} 0 obj\n`)
  }

  push('%PDF-1.4\n')
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])) // a comment of high bytes: the file is binary
  begin(1)
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  begin(2)
  push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 3} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`)
  begin(3)
  push(`<< /Title (${pdfText(title)}) /Producer (CarreApp) >>\nendobj\n`)
  pages.forEach((page, i) => {
    const pageObj = 4 + i * 3
    const content = `q ${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ`
    begin(pageObj)
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 ${pageObj + 2} 0 R >> >> /Contents ${pageObj + 1} 0 R >>\nendobj\n`)
    begin(pageObj + 1)
    push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`)
    begin(pageObj + 2)
    push(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`)
    push(page.jpeg)
    push('\nendstream\nendobj\n')
  })

  const count = 4 + pages.length * 3
  const xref = length
  push(`xref\n0 ${count}\n0000000000 65535 f \n`)
  for (let n = 1; n < count; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`)
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`)

  const out = new Uint8Array(length)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
