/** Faturanın HTML gösterimini ve resmi belge paketini (ZIP) alma. */
import { writeFile } from 'node:fs/promises'

import { EArsivClient, Unit } from '../src/index.js'

const client = new EArsivClient({ environment: 'test' })
await client.loginWithTestUser()

const { ettn } = await client.createDraft({
  buyer: { taxOrIdentityNumber: '11111111111', title: 'ÖRNEK A.Ş.' },
  lineItems: [{ name: 'Hizmet', quantity: 1, unit: Unit.PIECE, unitPrice: 250, vatRate: 20 }],
})

const html = await client.getInvoiceHtml(ettn)
await writeFile(`${ettn}.html`, html, 'utf8')

// ZIP içinde <ettn>_f.html ve imzalı <ettn>_f.xml (UBL-TR) bulunur; PDF yoktur.
const zip = await client.downloadPackage(ettn)
await writeFile(`${ettn}.zip`, zip)

console.log('İndirme adresi:', client.getDownloadUrl(ettn))
console.log('Kaydedildi:', `${ettn}.html`, `${ettn}.zip`)

// PDF isterseniz puppeteer kurulu olmalı:
// const pdf = await client.toPdf(ettn)
// await writeFile(`${ettn}.pdf`, pdf)

await client.logout()
