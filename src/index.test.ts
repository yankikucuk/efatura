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
