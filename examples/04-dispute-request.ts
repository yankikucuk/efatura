/**
 * İptal ve itiraz talepleri.
 *
 * Talep yalnızca ONAYLANMIŞ (imzalanmış) bir belge için ve belge başına bir
 * kez açılabilir. Test ortamındaki taslaklar onaysız olduğu için buradaki
 * oluşturma çağrıları iş kuralı hatası verir; akışın kendisi doğrudur.
 */
import { DisputeAnswer, DisputeMethod, EArsivApiError, EArsivClient } from '../src/index.js'

const client = new EArsivClient({ environment: 'test' })
await client.loginWithTestUser()

// Size gelen talepler
const incoming = await client.listDisputeRequests(new Date(), new Date())
console.log('Gelen talep sayısı:', incoming.length)

for (const request of incoming) {
  console.log(
    `#${request.disputeId}`,
    request.documentNumber,
    request.kind === '0' ? 'iptal' : 'itiraz',
    'durum:',
    request.status,
  )
}

// Gelen bir talebi cevaplama
if (incoming[0] !== undefined) {
  await client.respondToDisputeRequest({
    disputeId: incoming[0].disputeId,
    answer: DisputeAnswer.REJECT,
    rejectionReason: 'Belge doğru düzenlenmiştir.',
  })
}

// Kendi belgeniz için iptal talebi
try {
  await client.createCancellationRequest({
    ettn: '00000000-0000-0000-0000-000000000000',
    reason: 'Belge yanlış tutarla düzenlendi.',
  })
} catch (error) {
  if (error instanceof EArsivApiError) console.log('Portal:', error.message)
  else throw error
}

// Adınıza düzenlenmiş bir belgeye itiraz
try {
  await client.createObjectionRequest({
    ettn: '00000000-0000-0000-0000-000000000000',
    method: DisputeMethod.KEP,
    referenceDocumentId: '2026/42',
    referenceDocumentDate: new Date(),
    reason: 'Söz konusu hizmet tarafımıza sunulmamıştır.',
  })
} catch (error) {
  if (error instanceof EArsivApiError) console.log('Portal:', error.message)
  else throw error
}

await client.logout()
