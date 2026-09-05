/**
 * Portal `pageName` alanını sunucu tarafında doğruluyor; yanlış ekran adı
 * "Bu işlem için yetkiniz yok" hatasına yol açar.
 */
export const PageName = {
  MAIN_MENU: 'MAINTREEMENU',
  INVOICE_FORM: 'RG_BASITFATURA',
  INTERACTIVE_DRAFTS: 'RG_BASITTASLAKLAR',
  DRAFTS: 'RG_TASLAKLAR',
  INCOMING_DRAFTS: 'RG_ALICI_TASLAKLAR',
  /** Entegratör (portal harici) adıma düzenlenen belgeler ekranı. */
  INCOMING_INTEGRATOR: 'RG_ALICI_ENTEGRATOR',
  DISPUTE_DRAFTS: 'RG_IPTALITIRAZTASLAKLAR',
  USER: 'RG_KULLANICI',
  SMS_APPROVAL: 'RG_SMSONAY',
} as const

export type PageNameValue = (typeof PageName)[keyof typeof PageName]
