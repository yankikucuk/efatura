/**
 * Sıfır çalışma zamanı bağımlılığı garantisinin MAKİNE tarafından
 * doğrulanabilir kanıtı.
 *
 * README'nin ilk cümlesi ve npm sayfasındaki "0 dependencies" rozeti tek bir
 * alana dayanır. İddia bu yüzden bir belgede değil, bir testte tutuluyor.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * `package.json`'daki `dependencies: {}` iki kez sessizce silindi (`npm i -D`
 * her ikisinde de boş nesneyi kaldırdı — npm "yok" ile "boş" arasında fark
 * gözetmiyor, bu yüzden hiçbir şey bozulmadı). Ama README'nin ilk cümlesinin
 * vaat ettiği "sıfır çalışma zamanı bağımlılığı" iddiasının greplenebilir
 * kanıtı bu alandır (round 2 madde 4). Bu test onu sabitler; bir sonraki
 * `npm install -D` bunu tekrar silerse bu test kırılır.
 */
describe('package.json içindeki dependencies alanı (round 2 madde 4)', () => {
  // Kapsam: yayınlanan paketin çalışma zamanında hiçbir şey indirmediğinin
  // tek greplenebilir kanıtı.
  it('boş nesne olarak MEVCUTTUR — sıfır çalışma zamanı bağımlılığı garantisi', () => {
    const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url))
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as Record<string, unknown>

    expect(pkg.dependencies).toEqual({})
  })
})
