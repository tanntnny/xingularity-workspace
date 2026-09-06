import { describe, expect, it } from 'vitest'

import {
  DEFAULT_DESIGN_AUDIT_TAB,
  DESIGN_AUDIT_GROUPS,
  DESIGN_AUDIT_TABS,
  DESIGN_AUDIT_TOKEN_GROUPS,
  DESIGN_AUDIT_TAB_IDS
} from '../src/renderer/src/lib/designAuditCatalog'

describe('design audit catalog', () => {
  it('has a unique, valid default tab in every required group', () => {
    const tabIds = DESIGN_AUDIT_TABS.map((tab) => tab.id)

    expect(new Set(tabIds).size).toBe(tabIds.length)
    expect(DESIGN_AUDIT_TAB_IDS.has(DEFAULT_DESIGN_AUDIT_TAB)).toBe(true)
    expect(new Set(DESIGN_AUDIT_GROUPS.map((group) => group.id)).size).toBe(
      DESIGN_AUDIT_GROUPS.length
    )
    expect(DESIGN_AUDIT_GROUPS.map((group) => group.id)).toEqual([
      'foundations',
      'actions',
      'forms',
      'display',
      'overlays'
    ])

    for (const tab of DESIGN_AUDIT_TABS) {
      expect(DESIGN_AUDIT_GROUPS.some((group) => group.id === tab.groupId)).toBe(true)
      expect(tab.label.length).toBeGreaterThan(0)
      expect(tab.description.length).toBeGreaterThan(0)
    }

    for (const group of DESIGN_AUDIT_GROUPS) {
      expect(group.label.length).toBeGreaterThan(0)
      expect(group.description.length).toBeGreaterThan(0)
      expect(DESIGN_AUDIT_TABS.filter((tab) => tab.groupId === group.id)).not.toHaveLength(0)
    }
  })

  it('keeps component variant metadata explicit for component tabs', () => {
    const componentTabs = DESIGN_AUDIT_TABS.filter((tab) => tab.components.length > 0)

    expect(componentTabs.length).toBeGreaterThan(0)
    for (const tab of componentTabs) {
      for (const component of tab.components) {
        expect(component.name.length).toBeGreaterThan(0)
        expect(component.variants.length).toBeGreaterThan(0)
      }
    }
  })

  it('keeps token groups populated with semantic CSS variables', () => {
    expect(DESIGN_AUDIT_TOKEN_GROUPS.length).toBeGreaterThanOrEqual(4)
    for (const group of DESIGN_AUDIT_TOKEN_GROUPS) {
      expect(group.tokens.length).toBeGreaterThan(0)
      expect(group.tokens.every((token) => token.name.startsWith('--'))).toBe(true)
    }
  })
})
