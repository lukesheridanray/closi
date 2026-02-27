import useAuthStore from '@/stores/authStore'

interface EntityLabel {
  singular: string
  plural: string
  singularLower: string
  pluralLower: string
}

const DEFAULT_DEAL_LABEL: EntityLabel = {
  singular: 'Deal',
  plural: 'Deals',
  singularLower: 'deal',
  pluralLower: 'deals',
}

export function useEntityLabels() {
  const settings = useAuthStore((s) => s.organization?.settings)

  const deal: EntityLabel = (() => {
    const custom = settings?.entity_labels?.deal
    if (custom?.singular && custom?.plural) {
      return {
        singular: custom.singular,
        plural: custom.plural,
        singularLower: custom.singular.toLowerCase(),
        pluralLower: custom.plural.toLowerCase(),
      }
    }
    return DEFAULT_DEAL_LABEL
  })()

  return { deal }
}
