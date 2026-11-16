import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readTablesFromFile } from '../../src/lib/bulk'

describe('probe', () => {
  it('reads docx and xlsx with the browser readers under Node', async () => {
    for (const name of ['plantilla-carrera.docx', 'plantilla-carrera.xlsx', 'plantilla-personas.csv']) {
      const buf = fs.readFileSync(`public/plantillas/${name}`)
      const file = new File([buf], name)
      const tables = await readTablesFromFile(file)
      console.log(name, tables.length, tables.map((t) => t[0].join('/')).slice(0, 3))
      expect(tables.length).toBeGreaterThan(0)
    }
  })
})
