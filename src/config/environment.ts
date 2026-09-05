export const Environment = { PRODUCTION: 'production', TEST: 'test' } as const
export type EnvironmentName = (typeof Environment)[keyof typeof Environment]

/** Portalın canlı ve test ortamlarının taban adresleri. */
export const BASE_URLS: Record<EnvironmentName, string> = {
  production: 'https://earsivportal.efatura.gov.tr',
  test: 'https://earsivportaltest.efatura.gov.tr',
}
