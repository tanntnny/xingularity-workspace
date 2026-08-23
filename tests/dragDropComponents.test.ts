import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DragSource } from '../src/renderer/src/components/ui/drag-source'
import { DropZone } from '../src/renderer/src/components/ui/drop-zone'

describe('DragSource', () => {
  it('renders a semantic draggable source with controlled dragging state', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        DragSource,
        { as: 'article', dragging: true, className: 'task-card' },
        'Task card'
      )
    )

    expect(markup).toContain('<article')
    expect(markup).toContain('draggable="true"')
    expect(markup).toContain('data-dragging="true"')
    expect(markup).toContain('data-drag-visual="source"')
    expect(markup).toContain('data-drag-preview-target="source"')
    expect(markup).toContain('data-drag-preview-axis="both"')
    expect(markup).toContain('data-drag-preview-motion="none"')
    expect(markup).toContain('data-drag-preview-elevation="default"')
    expect(markup).toContain('data-[dragging=true]:opacity-0')
    expect(markup).not.toContain('data-[dragging=true]:rotate-[var(--drag-preview-rotation)]')
    expect(markup).toContain('--drag-preview-rotation:-2deg')
    expect(markup).toContain('task-card')
  })

  it('renders a rotated preview visual without changing source layout semantics', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        DragSource,
        { as: 'li', visual: 'preview', preview: 'none', rotation: -2 },
        'Notebook row'
      )
    )

    expect(markup).toContain('<li')
    expect(markup).not.toContain('draggable="true"')
    expect(markup).toContain('data-drag-visual="preview"')
    expect(markup).toContain('--drag-preview-rotation:-2deg')
    expect(markup).toContain('data-[drag-visual=preview]:rotate-[var(--drag-preview-rotation)]')
  })

  it('supports previews that preserve the child content styling', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        DragSource,
        { as: 'article', previewVariant: 'content', previewSizing: 'fit-content' },
        React.createElement('div', { className: 'task-type-card' }, 'Task card')
      )
    )

    expect(markup).toContain('data-drag-preview-variant="content"')
    expect(markup).toContain('data-drag-preview-sizing="fit-content"')
    expect(markup).toContain('data-[drag-visual=preview]:bg-transparent')
    expect(markup).toContain('data-[drag-visual=preview]:border-transparent')
    expect(markup).toContain('data-[drag-visual=preview]:opacity-100')
    expect(markup).not.toContain('data-[drag-visual=preview]:bg-[var(--drag-preview-bg)]')
  })

  it('supports axis-locked, smoothly moving, elevated custom previews', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        DragSource,
        {
          as: 'button',
          preview: 'floating',
          previewAxis: 'y',
          previewMotion: 'smooth',
          previewElevation: 'strong',
          hideFromPreview: true,
          previewTargetRef: { current: null }
        },
        'Milestone handle'
      )
    )

    expect(markup).toContain('data-drag-preview-target="custom"')
    expect(markup).toContain('data-drag-preview-axis="y"')
    expect(markup).toContain('data-drag-preview-motion="smooth"')
    expect(markup).toContain('data-drag-preview-elevation="strong"')
    expect(markup).toContain('data-drag-preview-ignore="true"')
    expect(markup).toContain('data-[drag-visual=preview]:shadow-2xl')
  })
})

describe('DropZone', () => {
  it('renders a semantic active surface with shared drop-state attributes', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        DropZone,
        { as: 'section', active: true, variant: 'surface', 'aria-label': 'Drop tasks here' },
        'Drop target'
      )
    )

    expect(markup).toContain('<section')
    expect(markup).toContain('data-drag-over="true"')
    expect(markup).toContain('data-drop-zone-variant="surface"')
    expect(markup).toContain('bg-[var(--drop-zone-active-bg)]')
    expect(markup).toContain('border-[var(--drop-zone-active-border)]')
  })

  it('keeps geometry variants on the same shared active visual contract', () => {
    const variants = ['surface', 'indicator', 'timed', 'row'] as const

    for (const variant of variants) {
      const markup = renderToStaticMarkup(
        React.createElement(DropZone, { active: true, variant }, variant)
      )

      expect(markup).toContain(`data-drop-zone-variant="${variant}"`)
      expect(markup).toContain('bg-[var(--drop-zone-active-bg)]')
      if (variant === 'row') {
        expect(markup).toContain('data-[drag-over=true]:shadow-sm')
        expect(markup).not.toContain(
          'data-[drag-over=true]:border-[var(--drop-zone-active-border)]'
        )
      } else {
        expect(markup).toContain('border-[var(--drop-zone-active-border)]')
      }
    }

    const timedMarkup = renderToStaticMarkup(
      React.createElement(DropZone, { active: true, variant: 'timed' }, 'timed')
    )
    expect(timedMarkup).not.toContain('pointer-events-none')
  })

  it('applies the calendar drop background tone only when requested', () => {
    const markup = renderToStaticMarkup(
      React.createElement(DropZone, { active: true, tone: 'calendar', variant: 'indicator' })
    )

    expect(markup).toContain('data-drop-zone-tone="calendar"')
    expect(markup).toContain('background:var(--calendar-drop-zone-active-bg)')
    expect(markup).toContain('border-0')
    expect(markup).not.toContain('data-[drag-over=true]:border-[var(--drop-zone-active-border)]')
    expect(markup).not.toContain('transform:rotate(var(--drag-preview-rotation))')

    const defaultMarkup = renderToStaticMarkup(
      React.createElement(DropZone, { active: true, variant: 'indicator' })
    )
    expect(defaultMarkup).not.toContain('transform:rotate(var(--drag-preview-rotation))')
  })

  it('uses the borderless calendar drop background for unscheduled drops', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        DropZone,
        { active: true, tone: 'calendar-unscheduled', variant: 'surface' },
        'Unscheduled tasks'
      )
    )

    expect(markup).toContain('data-drop-zone-tone="calendar-unscheduled"')
    expect(markup).toContain('background:var(--calendar-drop-zone-active-bg)')
    expect(markup).toContain('border-0')
    expect(markup).not.toContain('border-color:transparent')
  })
})
