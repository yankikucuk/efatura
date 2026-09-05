/** Fatura oluşturma. Toplamlar kalemlerden otomatik hesaplanır. */
import { Country, Currency, EArsivClient, Unit } from '../src/index.js'

const client = new EArsivClient({ environment: 'test' })
await client.loginWithTestUser()

const created = await client.createDraft({
  currency: Currency.TURKISH_LIRA,
  buyer: {
    taxOrIdentityNumber: '11111111111',
    firstName: 'Ali',
    lastName: 'Yılmaz',
    taxOffice: 'Maltepe',
    address: {
      country: Country.TURKIYE,
      city: 'İstanbul',
      district: 'Maltepe',
      street: 'Deneme Sk. No:1',
    },
    contact: { email: 'ali@ornek.test' },
  },
  lineItems: [
    { name: 'Yazılım Geliştirme', quantity: 28, unit: Unit.DAY, unitPrice: 3, vatRate: 20 },
    {
      name: 'Danışmanlık',
      quantity: 4,
      unit: Unit.HOUR,
      unitPrice: 500,
      vatRate: 20,
      discountRate: 10,
      discountReason: 'Kampanya',
    },
  ],
  note: 'Eylül 2026 hizmet bedeli',
})

console.log('ETTN:', created.ettn)
console.log('Belge no:', created.documentNumber)
console.log('Onay durumu:', created.approvalStatus)

await client.logout()
