import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import importX from 'eslint-plugin-import-x'
import tseslint from 'typescript-eslint'

/** Kardeş izolasyonu için modül listesi. Yeni modül eklenince buraya yazılır. */
const MODULES = ['auth', 'invoice', 'document', 'user', 'signing', 'dispute']
const SIBLING_MESSAGE = 'Modüller birbirine bağımlı olamaz; ortak ihtiyaç core katmanına iner.'

/** Bir katmanın import etmesi YASAK olan yolları üretir. */
const forbid = (patterns, message) => ({
  'no-restricted-imports': [
    'error',
    { patterns: patterns.map((group) => ({ group: [group], message })) },
  ],
})

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'import-x': importX },
    // I3: `import-x/no-cycle` gerçek dosya yolunu çözebilen bir resolver
    // OLMADAN hiçbir şey rapor etmiyordu — `.js` uzantılı bir TS import'unu
    // (`./b.js` -> `./b.ts`) haritalayamadığı için sessizce hiç ateşlenmedi.
    // Bu, `no-restricted-paths` için daha önce düzeltilmiş olan aynı
    // sessiz-etkisizlik sınıfı. `eslint-import-resolver-typescript`
    // `tsconfig.json` üzerinden gerçek dosyayı çözer; artık kural ateşleniyor
    // (doğrulama: bkz. final-fixes-report.md).
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver()],
      // `import-x`'in ExportMap tabanlı kuralları (ör. `no-cycle`) bir
      // dosyayı ayrıştırmadan ÖNCE uzantısını `import-x/extensions`
      // listesine karşı kontrol ediyor; varsayılan liste yalnızca
      // `.js/.mjs/.cjs` içeriyor. Bu ayar olmadan her `.ts` dosyası sessizce
      // (hiçbir log/hata olmadan) "geçersiz uzantı" sayılıp atlanıyor ve
      // `no-cycle` hiçbir zaman gerçek bir döngü görmüyor — resolver doğru
      // çalışsa bile. Doğrulama: bkz. final-fixes-report.md.
      'import-x/extensions': ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'],
    },
    rules: {
      'import-x/no-cycle': ['error', { maxDepth: Infinity }],
      'import-x/order': ['error', { 'newlines-between': 'always', alphabetize: { order: 'asc' } }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
    },
  },
  // eslint.config.js tsconfig.json'un include listesine girmez (yalnızca
  // *.config.ts eşleşir); tip-farkında lint bu dosyada projectService
  // hatası üretir, bu yüzden burada kapatılır.
  {
    files: ['eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  // Katman: core — hiçbir üst katmana bakamaz.
  {
    files: ['src/core/**/*.ts'],
    rules: forbid(
      ['**/transport/**', '**/modules/**', '**/client/**', '**/pdf/**'],
      'core katmanı yalnızca kendi içine ve constants/config yapraklarına bağımlı olabilir.',
    ),
  },
  // Katman: transport — modules, client ve pdf yasak.
  {
    files: ['src/transport/**/*.ts'],
    rules: forbid(
      ['**/modules/**', '**/client/**', '**/pdf/**'],
      'transport katmanı modules/client/pdf katmanlarına bağımlı olamaz.',
    ),
  },
  // Katman: documents — core ve constants dışında hiçbir şeye bağımlı
  // olamaz. `modules/*` bunu SERBESTÇE import edebilir (kardeş modül
  // DEĞİL, `constants`/`config` gibi bir yaprak katman) — bu yüzden
  // aşağıdaki kardeş izolasyonu bloğunun `MODULES` listesine eklenmedi.
  {
    files: ['src/documents/**/*.ts'],
    rules: forbid(
      ['**/transport/**', '**/modules/**', '**/client/**', '**/pdf/**'],
      'documents katmanı yalnızca core ve constants/config yapraklarına bağımlı olabilir.',
    ),
  },
  // Katman: modules — client ve pdf yasak.
  //
  // DİKKAT (I2): flat config'te aynı dosya seti için aynı kuralın SONRAKİ
  // bir bloktaki ayarı, öncekini BİRLEŞTİRMEZ — YERİNE GEÇİRİR. Aşağıdaki
  // kardeş izolasyonu bloğu her `src/modules/<isim>/**/*.ts` için
  // `no-restricted-imports`'u YENİDEN tanımlıyor; bu blok burada kalsa bile
  // her modül dosyası için aşağıdaki blok tarafından SİLİNİR ve client/pdf
  // yasağı modül kodu için sessizce yok olur (canlı doğrulandı: bir modül
  // içinden `../../client/index.js` ve `../../pdf/index.js` import etmek
  // sıfır hata veriyordu). Gerçek zorlama bu yüzden aşağıdaki
  // `MODULES.map(...)` bloğunun `patterns` dizisinde, kardeş desenleriyle
  // AYNI ARRAY içinde yapılıyor. Bu blok yalnızca `src/modules/**` altında
  // ama hiçbir `MODULES` girdisiyle eşleşmeyen (ör. yeni eklenip listeye
  // henüz yazılmamış) dosyalar için bir güvenlik ağı olarak kalıyor.
  {
    files: ['src/modules/**/*.ts'],
    rules: forbid(
      ['**/client/**', '**/pdf/**'],
      'Modüller client/pdf katmanlarına bağımlı olamaz.',
    ),
  },
  // Kardeş modül izolasyonu + katman yasağı (I2 nedeniyle TEK blokta).
  //
  // Kardeş izolasyonunda iki tuzak var. (1) Joker desen: `../*/**` deseni
  // `../../core/index.js` yolunu da yakalar, çünkü minimatch'te `*` `..`
  // segmentiyle eşleşir — her meşru core import'u yanlış pozitif olurdu.
  // (2) no-restricted-paths: gerçek dosya yolu çözer ama bunun için bir
  // resolver gerekir; `.js` uzantılı TS import'larını çözemediğinden kural
  // HİÇ ateşlenmez ve izolasyon sessizce yok olur.
  //
  // Çözüm ikisi de değil: kardeş adlarını AÇIK yazmak. `../invoice/**`
  // deseni `../../core/index.js` ile eşleşmez (ikinci segment `invoice` vs
  // `..`), resolver gerektirmez ve specifier metnine bakar.
  //
  // client/pdf desenleri BURADA, kardeş desenleriyle AYNI `patterns`
  // dizisinde tekrarlanıyor — yukarıdaki genel "Katman: modules" bloğu bu
  // dosyalar için tamamen ezildiği için başka yolu yok.
  ...MODULES.map((self) => ({
    files: [`src/modules/${self}/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...['**/client/**', '**/pdf/**'].map((group) => ({
              group: [group],
              message: 'Modüller client/pdf katmanlarına bağımlı olamaz.',
            })),
            ...MODULES.filter((other) => other !== self)
              .flatMap((other) => [`../${other}/**`, `../../modules/${other}/**`])
              .map((group) => ({ group: [group], message: SIBLING_MESSAGE })),
          ],
        },
      ],
    },
  })),
  // Katman: constants ve config yapraktır.
  {
    files: ['src/constants/**/*.ts', 'src/config/**/*.ts'],
    rules: forbid(
      ['**/transport/**', '**/modules/**', '**/client/**', '**/pdf/**'],
      'constants ve config yaprak katmanlardır; hiçbir üst katmana bağımlı olamaz.',
    ),
  },
  // Testler ve örnekler daha gevşek.
  {
    files: ['**/*.test.ts', 'tests/**/*.ts', 'examples/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  prettier,
)
