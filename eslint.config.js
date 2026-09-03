import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import importX from 'eslint-plugin-import-x'
import tseslint from 'typescript-eslint'

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
  // Katman: modules — client ve pdf yasak.
  {
    files: ['src/modules/**/*.ts'],
    rules: forbid(
      ['**/client/**', '**/pdf/**'],
      'Modüller client/pdf katmanlarına bağımlı olamaz.',
    ),
  },
  // Kardeş modül izolasyonu. Glob tabanlı no-restricted-imports burada
  // yanlış pozitif üretir (`../*/**` deseni `../../core/...` yolunu da
  // yakalar), bu yüzden gerçek dosya yolu çözen no-restricted-paths kullanılır.
  {
    files: ['src/modules/**/*.ts'],
    rules: {
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/modules/auth',
              from: [
                './src/modules/invoice',
                './src/modules/document',
                './src/modules/user',
                './src/modules/signing',
                './src/modules/dispute',
              ],
              message: 'Modüller birbirine bağımlı olamaz; ortak ihtiyaç core katmanına iner.',
            },
            {
              target: './src/modules/invoice',
              from: [
                './src/modules/auth',
                './src/modules/document',
                './src/modules/user',
                './src/modules/signing',
                './src/modules/dispute',
              ],
              message: 'Modüller birbirine bağımlı olamaz; ortak ihtiyaç core katmanına iner.',
            },
            {
              target: './src/modules/document',
              from: [
                './src/modules/auth',
                './src/modules/invoice',
                './src/modules/user',
                './src/modules/signing',
                './src/modules/dispute',
              ],
              message: 'Modüller birbirine bağımlı olamaz; ortak ihtiyaç core katmanına iner.',
            },
            {
              target: './src/modules/user',
              from: [
                './src/modules/auth',
                './src/modules/invoice',
                './src/modules/document',
                './src/modules/signing',
                './src/modules/dispute',
              ],
              message: 'Modüller birbirine bağımlı olamaz; ortak ihtiyaç core katmanına iner.',
            },
            {
              target: './src/modules/signing',
              from: [
                './src/modules/auth',
                './src/modules/invoice',
                './src/modules/document',
                './src/modules/user',
                './src/modules/dispute',
              ],
              message: 'Modüller birbirine bağımlı olamaz; ortak ihtiyaç core katmanına iner.',
            },
            {
              target: './src/modules/dispute',
              from: [
                './src/modules/auth',
                './src/modules/invoice',
                './src/modules/document',
                './src/modules/user',
                './src/modules/signing',
              ],
              message: 'Modüller birbirine bağımlı olamaz; ortak ihtiyaç core katmanına iner.',
            },
          ],
        },
      ],
    },
  },
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
