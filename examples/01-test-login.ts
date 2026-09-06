/** Test ortamında otomatik kullanıcıyla giriş ve firma bilgisi okuma. */
import { EArsivClient } from '../src/index.js'

const client = new EArsivClient({ environment: 'test' })

// Dönen nesne `password` alanını da taşır: `loginWithTestUser()` her
// çağrıda portaldan YENİ bir geçici kullanıcı ister, dolayısıyla aynı
// kullanıcıya sonradan `login()` ile dönmek istiyorsanız şifreyi saklamanız
// gerekir. Ama onu log'a BASMAYIN — örnekler kopyalanır ve bu satır bir gün
// gerçek bir mükellef şifresini terminale, CI çıktısına ve log toplayıcıya
// düz metin olarak yazar.
const { username } = await client.loginWithTestUser()
console.log('Test kullanıcısı:', username)

const info = await client.getUserInfo()
console.log('Ünvan:', info.title)
console.log('VKN:', info.taxOrIdentityNumber)
console.log('Vergi dairesi:', info.taxOffice)

await client.logout()
