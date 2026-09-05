/**
 * Belge indirme — HER ÜÇ belge türü.
 *
 * İndirme uç noktası tek bir adrestir ama sorgudaki `belgeTip` alanı belgenin
 * TÜRÜNÜ taşımak zorundadır ve dönen FORMAT da türe göre değişir:
 *
 *   Fatura                 -> ZIP  (<ettn>_f.zip)
 *   Müstahsil Makbuzu      -> ZIP  (<ettn>_m.zip)
 *   Serbest Meslek Makbuzu -> PDF  (<ettn>_s.pdf)   <-- ZIP DEĞİL
 *
 * Yanlış tür SESSİZCE boş yanıt üretir (portal `HTTP 200` + 0 bayt, hata metni
 * yok), bu yüzden makbuzlarda türe özel metotları kullanın. `content-type`
 * başlığı üç türde de `application/json` yazar; YANILTICIDIR — format yalnızca
 * sihirli baytlardan anlaşılır (ZIP `PK`, PDF `%PDF`).
 */
import { writeFile } from 'node:fs/promises'

import { EArsivClient, Unit } from '../src/index.js'

const magic = (bytes: Uint8Array): string => new TextDecoder('latin1').decode(bytes.slice(0, 4))

const client = new EArsivClient({ environment: 'test' })
await client.loginWithTestUser()

// — Fatura —
const { ettn } = await client.createDraft({
  buyer: { taxOrIdentityNumber: '11111111111', title: 'ÖRNEK A.Ş.' },
  lineItems: [{ name: 'Hizmet', quantity: 1, unit: Unit.PIECE, unitPrice: 250, vatRate: 20 }],
})

const html = await client.getInvoiceHtml(ettn)
await writeFile(`${ettn}.html`, html, 'utf8')

// ZIP içinde <ettn>_f.html ve imzalı <ettn>_f.xml (UBL-TR) bulunur; PDF yoktur.
const zip = await client.downloadPackage(ettn)
await writeFile(`${ettn}_f.zip`, zip)
console.log('Fatura paketi:', magic(zip), zip.byteLength, 'bayt')

// — Müstahsil Makbuzu —
const producerReceipt = await client.createProducerReceipt({
  producer: { taxOrIdentityNumber: '11111111111', firstName: 'Ayşe', lastName: 'Demir' },
  city: 'Konya',
  lineItems: [
    {
      name: 'Buğday',
      quantity: 100,
      unit: Unit.KILOGRAM,
      unitPrice: 12,
      taxRates: { incomeTaxWithholding: 2 },
    },
  ],
})

// Fatura ile aynı format (ZIP), ama dosyalar `_m` ekiyle adlandırılır.
const producerZip = await client.downloadProducerReceiptPackage(producerReceipt.ettn)
await writeFile(`${producerReceipt.ettn}_m.zip`, producerZip)
console.log('Müstahsil paketi:', magic(producerZip), producerZip.byteLength, 'bayt')

// — Serbest Meslek Makbuzu —
const selfEmployedReceipt = await client.createSelfEmployedReceipt({
  payer: { taxOrIdentityNumber: '1111111111', title: 'ÖRNEK A.Ş.', taxOffice: 'Kadıköy' },
  description: 'Eylül 2026 danışmanlık',
  lineItems: [
    { description: 'Mali müşavirlik', grossFee: 10_000, vatRate: 20, withholdingRate: 20 },
  ],
})

// SMM'nin HTML gösterimi portalda bozuktur, AMA basılabilir resmî belgeye
// buradan erişilir: ZIP değil, doğrudan PDF döner.
const receiptPdf = await client.downloadSelfEmployedReceiptPdf(selfEmployedReceipt.ettn)
await writeFile(`${selfEmployedReceipt.ettn}_s.pdf`, receiptPdf)
console.log('SMM belgesi:', magic(receiptPdf), receiptPdf.byteLength, 'bayt')

// Adresler ağa çıkmadan da üretilebilir. UYARI: CANLI token taşırlar —
// günlüğe yazmayın, paylaşmayın.
console.log('Fatura indirme adresi:', client.getDownloadUrl(ettn))
console.log('Müstahsil adresi:', client.getProducerReceiptDownloadUrl(producerReceipt.ettn))
console.log('SMM PDF adresi:', client.getSelfEmployedReceiptPdfUrl(selfEmployedReceipt.ettn))

// Fatura/müstahsil için YEREL PDF isterseniz puppeteer kurulu olmalı; o çıktı
// resmî imzalı belge değildir. SMM'de buna gerek yok, yukarıdaki PDF resmîdir.
// const pdf = await client.toPdf(ettn)
// await writeFile(`${ettn}.pdf`, pdf)

await client.logout()
