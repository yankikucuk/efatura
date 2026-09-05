/** Test ortamında otomatik kullanıcıyla giriş ve firma bilgisi okuma. */
import { EArsivClient } from '../src/index.js'

const client = new EArsivClient({ environment: 'test' })

const { username, password } = await client.loginWithTestUser()
console.log('Test kullanıcısı:', username, '/', password)

const info = await client.getUserInfo()
console.log('Ünvan:', info.title)
console.log('VKN:', info.taxOrIdentityNumber)
console.log('Vergi dairesi:', info.taxOffice)

await client.logout()
