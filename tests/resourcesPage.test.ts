import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ResourceFiltersPopover } from '../src/renderer/src/components/ResourceFiltersPopover'
import { ResourceSearchInput, ResourcesPage } from '../src/renderer/src/pages/ResourcesPage'
import type { ResourceFilterOptions } from '../src/renderer/src/lib/resourceRows'
import { normalizeResourceInput } from '../src/shared/resourceDomain'
import type { Project } from '../src/shared/types'

const project: Project = {
  id: 'project-1',
  name: 'Atlas',
  description: '',
  summary: '',
  state: 'active',
  updatedAt: '2026-08-20T00:00:00.000Z',
  icon: { variant: 'filled', color: '#2563eb' },
  milestones: []
}

describe('ResourcesPage', () => {
  it('renders the global resource table with labels and project context', () => {
    const resource = normalizeResourceInput({
      canonicalUri: 'https://example.com/brief',
      title: 'Brief',
      labels: [{ key: 'status', value: 'active' }],
      projectIds: [project.id]
    })
    const markup = renderToStaticMarkup(
      createElement(ResourcesPage, {
        projects: [project],
        noteTree: [],
        resources: [resource],
        relations: [],
        onCreateResource: async () => undefined,
        onUpdateResource: async () => undefined,
        onSetResourceProjectLinks: async () => undefined,
        onRemoveResource: async () => undefined,
        onOpenResource: async () => undefined,
        onOpenNotebookResource: () => undefined
      })
    )

    expect(markup).toContain('data-testid="resources-page"')
    expect(markup).toContain('data-testid="resources-table"')
    expect(markup).toContain('>Labels</span>')
    expect(markup).toContain('>Projects</span>')
    expect(markup).toContain('status=active')
    expect(markup).toContain('Atlas')
    expect(markup).not.toContain('data-testid="resource-filters"')

    const searchMarkup = renderToStaticMarkup(
      createElement(ResourceSearchInput, { value: '', onChange: () => undefined })
    )
    expect(searchMarkup).toContain('data-testid="resource-search-input"')
    expect(searchMarkup).toContain('placeholder="Search resources"')
    expect(searchMarkup).toContain('focus-visible:rounded-[var(--radius-button-pill)]')
    expect(searchMarkup).toContain('focus-within:w-80')
  })

  it('renders an accessible filter trigger', () => {
    const options: ResourceFilterOptions = {
      types: [{ value: 'external', label: 'External' }],
      providers: [{ value: 'web', label: 'Web' }],
      states: [{ value: 'available', label: 'Available' }],
      projects: [{ value: 'project-1', label: 'Atlas' }],
      labels: { status: [{ value: 'active', label: 'active' }] }
    }
    const markup = renderToStaticMarkup(
      createElement(ResourceFiltersPopover, {
        options,
        value: {},
        onChange: () => undefined
      })
    )

    expect(markup).toContain('data-testid="resource-filters-trigger"')
    expect(markup).toContain('aria-label="Filter resources"')
    expect(markup).toContain('border border-input')
    expect(markup).toContain('Filter')
  })

  it('renders an actionable empty state for an empty resource collection', () => {
    const markup = renderToStaticMarkup(
      createElement(ResourcesPage, {
        projects: [],
        noteTree: [],
        resources: [],
        relations: [],
        onCreateResource: async () => undefined,
        onUpdateResource: async () => undefined,
        onSetResourceProjectLinks: async () => undefined,
        onRemoveResource: async () => undefined,
        onOpenResource: async () => undefined,
        onOpenNotebookResource: () => undefined
      })
    )

    expect(markup).toContain('No resources found')
    expect(markup).toContain('Use Add resource in the top bar')
  })
})
