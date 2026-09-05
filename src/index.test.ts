/**
 * Genel API yüzeyinin bileşen bazında kullanılabilirliği (spec §8 / I9).
 *
 * `EArsivClient` bir kolaylıktır, TEK giriş noktası değil: yalnızca fatura
 * kesmek isteyen çağıran `InvoiceService`'i kendi transport'uyla kurabilmeli.
 * Bu ancak servis sınıflarının VE constructor parametre tiplerinin
 * (`DispatchGateway`, `HttpClient`, `resolveClientOptions`) barrel'dan dışa
 * açık olmasıyla mümkündür — `transport` bir dönem hiç export edilmiyordu ve
 * servisler teknik olarak örneklenemez durumdaydı (I9).
 *
 * DÜRÜSTLÜK NOTU: bu süitin iki makbuz servisiyle ilgili iddiaları TDD ile
 * yazılmadı; eklendiklerinde barrel zaten güncellenmişti, yani kırmızı
 * görülmedi. Ayırt edicilikleri sonradan mutasyonla doğrulandı:
 * `modules/index.ts`'ten export kaldırılınca
 * "ProducerReceiptService is not a constructor" ile kırılıyor.
 */

import { describe, expect, it } from 'vitest'

import {
  AuthService,
  DispatchGateway,
  DocumentService,
  HttpClient,
  InvoiceService,
  ProducerReceiptService,
  resolveClientOptions,
  SelfEmployedReceiptService,
  SigningService,
  UserService,
} from './index.js'

describe('genel API yüzeyi — servisler tek başına örneklenebilir (I9)', () => {
  // Kapsam: `src/index.ts` barrel'ının her servisi ve constructor bağımlılık
  // tiplerini gerçekten dışa açtığı. Örnekleme başarısız olursa spec §8
  // ihlal edilmiş demektir.
  it('spec §8: her servis kendi transport bağımlılıklarıyla standalone kurulabilir', () => {
    const options = resolveClientOptions({ environment: 'test' })
    const http = new HttpClient(options)
    const auth = new AuthService(http, options)
    const gateway = new DispatchGateway(http, auth)

    expect(new InvoiceService(gateway)).toBeInstanceOf(InvoiceService)
    expect(new DocumentService(gateway, http, auth, options)).toBeInstanceOf(DocumentService)
    expect(new UserService(gateway)).toBeInstanceOf(UserService)
    expect(new SigningService(gateway)).toBeInstanceOf(SigningService)
    expect(new ProducerReceiptService(gateway)).toBeInstanceOf(ProducerReceiptService)
    expect(new SelfEmployedReceiptService(gateway)).toBeInstanceOf(SelfEmployedReceiptService)
  })
})
