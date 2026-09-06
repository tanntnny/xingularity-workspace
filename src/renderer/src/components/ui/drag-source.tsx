import * as React from 'react'
import { cn } from '../../lib/utils'

export type DragPreviewAxis = 'both' | 'x' | 'y'
export type DragPreviewMotion = 'none' | 'smooth'
export type DragPreviewElevation = 'default' | 'strong'
export type DragOperation = 'move' | 'copy'

type FloatingDragPreviewHandle = {
  cleanup: () => void
  setOperation: (operation: DragOperation) => void
}

type DragSourceOwnProps = {
  dragging?: boolean
  visual?: 'source' | 'preview'
  preview?: 'clone' | 'floating' | 'none'
  previewVariant?: 'surface' | 'content'
  previewSizing?: 'source' | 'fit-content'
  previewTargetRef?: React.RefObject<HTMLElement | null>
  previewAxis?: DragPreviewAxis
  previewMotion?: DragPreviewMotion
  previewElevation?: DragPreviewElevation
  hideFromPreview?: boolean
  onDragStart?: React.DragEventHandler<HTMLElement>
  onDragEnd?: React.DragEventHandler<HTMLElement>
  onDragOperationChange?: (operation: DragOperation) => void
}

export type DragSourceProps<T extends React.ElementType = 'div'> = DragSourceOwnProps &
  Omit<React.ComponentPropsWithoutRef<T>, keyof DragSourceOwnProps | 'draggable'> & {
    as?: T
    draggable?: boolean
  }

type DragSourceComponent = <T extends React.ElementType = 'div'>(
  props: DragSourceProps<T> & { ref?: React.Ref<HTMLElement> }
) => React.ReactElement | null

let activeFloatingPreviewCleanup: (() => void) | null = null

function setCloneDragImage(
  event: React.DragEvent<HTMLElement>,
  previewSizing: 'source' | 'fit-content'
): void {
  if (typeof document === 'undefined') {
    return
  }

  const source = event.currentTarget
  const dragPreview = source.cloneNode(true)
  if (!(dragPreview instanceof HTMLElement)) {
    return
  }

  const rect = source.getBoundingClientRect()
  dragPreview.dataset.dragVisual = 'preview'
  if (source.dataset.dragOperation) {
    dragPreview.dataset.dragOperation = source.dataset.dragOperation
  }
  dragPreview.style.position = 'fixed'
  dragPreview.style.top = '-9999px'
  dragPreview.style.left = '-9999px'
  dragPreview.style.width = `${rect.width}px`
  if (previewSizing === 'fit-content') {
    dragPreview.style.height = 'fit-content'
    dragPreview.style.minHeight = '0'
    dragPreview.style.maxHeight = 'none'
  }
  dragPreview.style.pointerEvents = 'none'
  dragPreview.style.animation = 'none'
  dragPreview.style.transition = 'none'
  dragPreview.style.opacity = '1'
  document.body.appendChild(dragPreview)

  event.dataTransfer.setDragImage(dragPreview, event.clientX - rect.left, event.clientY - rect.top)
  window.setTimeout(() => dragPreview.remove(), 0)
}

function createFloatingDragImage(
  event: React.DragEvent<HTMLElement>,
  {
    previewTarget,
    previewSizing,
    previewAxis,
    previewMotion,
    previewElevation,
    previewVariant,
    hidePreviewDescendants
  }: {
    previewTarget: HTMLElement
    previewSizing: 'source' | 'fit-content'
    previewAxis: DragPreviewAxis
    previewMotion: DragPreviewMotion
    previewElevation: DragPreviewElevation
    previewVariant: 'surface' | 'content'
    hidePreviewDescendants: boolean
  }
): FloatingDragPreviewHandle {
  if (typeof document === 'undefined') {
    return {
      cleanup: () => undefined,
      setOperation: () => undefined
    }
  }

  activeFloatingPreviewCleanup?.()
  activeFloatingPreviewCleanup = null

  const source = event.currentTarget
  const floatingPreview = previewTarget.cloneNode(true)
  if (!(floatingPreview instanceof HTMLElement)) {
    return {
      cleanup: () => undefined,
      setOperation: () => undefined
    }
  }

  const rect = previewTarget.getBoundingClientRect()
  const pointerOffsetX = event.clientX - rect.left
  const pointerOffsetY = event.clientY - rect.top
  const transparentDragImage = document.createElement('canvas')
  transparentDragImage.width = 1
  transparentDragImage.height = 1
  transparentDragImage.style.position = 'fixed'
  transparentDragImage.style.top = '-9999px'
  transparentDragImage.style.left = '-9999px'

  floatingPreview.dataset.dragVisual = 'preview'
  if (source.dataset.dragOperation) {
    floatingPreview.dataset.dragOperation = source.dataset.dragOperation
  }
  floatingPreview.dataset.floatingDragPreview = 'true'
  floatingPreview.dataset.dragPreviewTarget = 'custom'
  floatingPreview.dataset.dragPreviewAxis = previewAxis
  floatingPreview.dataset.dragPreviewMotion = previewMotion
  floatingPreview.dataset.dragPreviewElevation = previewElevation
  floatingPreview.setAttribute('aria-hidden', 'true')
  floatingPreview.classList.add(
    previewVariant === 'content' ? 'border-transparent' : 'border-[var(--drag-preview-border)]',
    previewVariant === 'content' ? 'bg-transparent' : 'bg-[var(--drag-preview-bg)]',
    previewVariant === 'content' ? 'opacity-100' : 'opacity-90',
    previewElevation === 'strong' ? 'shadow-2xl' : 'shadow-lg'
  )
  if (hidePreviewDescendants) {
    floatingPreview
      .querySelectorAll<HTMLElement>('[data-drag-preview-ignore="true"]')
      .forEach((element) => element.remove())
  }
  floatingPreview.style.position = 'fixed'
  floatingPreview.style.zIndex = '2147483647'
  floatingPreview.style.isolation = 'isolate'
  floatingPreview.style.width = `${rect.width}px`
  floatingPreview.style.boxSizing = 'border-box'
  floatingPreview.style.margin = '0'
  if (previewSizing === 'fit-content') {
    floatingPreview.style.height = 'fit-content'
    floatingPreview.style.minHeight = '0'
    floatingPreview.style.maxHeight = 'none'
  } else {
    floatingPreview.style.height = `${rect.height}px`
  }
  floatingPreview.style.pointerEvents = 'none'
  floatingPreview.style.animation = 'none'
  const motionDuration = 'var(--motion-duration-fast, 140ms)'
  const motionEasing = 'var(--motion-ease-standard, cubic-bezier(0.22, 1, 0.36, 1))'
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  floatingPreview.style.transition =
    previewMotion === 'smooth' && !prefersReducedMotion
      ? previewAxis === 'x'
        ? `left ${motionDuration} ${motionEasing}`
        : previewAxis === 'y'
          ? `top ${motionDuration} ${motionEasing}`
          : `left ${motionDuration} ${motionEasing}, top ${motionDuration} ${motionEasing}`
      : 'none'
  floatingPreview.style.willChange = previewAxis === 'y' ? 'top' : 'left, top'
  floatingPreview.style.opacity = '1'

  const applyPosition = (clientX: number, clientY: number): void => {
    if (clientX === 0 && clientY === 0) {
      return
    }
    floatingPreview.style.left =
      previewAxis === 'y' ? `${rect.left}px` : `${clientX - pointerOffsetX}px`
    floatingPreview.style.top =
      previewAxis === 'x' ? `${rect.top}px` : `${clientY - pointerOffsetY}px`
  }
  applyPosition(event.clientX, event.clientY)

  document.body.appendChild(floatingPreview)
  document.body.appendChild(transparentDragImage)
  event.dataTransfer.setDragImage(transparentDragImage, 0, 0)

  let frameId: number | null = null
  let pendingPosition: { clientX: number; clientY: number } | null = null
  const schedulePosition = (clientX: number, clientY: number): void => {
    if (clientX === 0 && clientY === 0) {
      return
    }
    pendingPosition = { clientX, clientY }
    if (frameId !== null) {
      return
    }
    frameId = window.requestAnimationFrame(() => {
      frameId = null
      const nextPosition = pendingPosition
      pendingPosition = null
      if (nextPosition) {
        applyPosition(nextPosition.clientX, nextPosition.clientY)
      }
    })
  }
  const handlePointerMove = (dragEvent: DragEvent): void => {
    schedulePosition(dragEvent.clientX, dragEvent.clientY)
  }
  const cleanup = (): void => {
    if (frameId !== null) {
      window.cancelAnimationFrame(frameId)
      frameId = null
    }
    pendingPosition = null
    source.removeEventListener('drag', handlePointerMove)
    window.removeEventListener('dragover', handlePointerMove, true)
    window.removeEventListener('drop', cleanup, true)
    window.removeEventListener('dragend', cleanup, true)
    floatingPreview.remove()
    transparentDragImage.remove()
    if (activeFloatingPreviewCleanup === cleanup) {
      activeFloatingPreviewCleanup = null
    }
  }

  const setOperation = (operation: DragOperation): void => {
    floatingPreview.dataset.dragOperation = operation
  }

  source.addEventListener('drag', handlePointerMove)
  window.addEventListener('dragover', handlePointerMove, true)
  window.addEventListener('drop', cleanup, true)
  window.addEventListener('dragend', cleanup, true)
  activeFloatingPreviewCleanup = cleanup

  return { cleanup, setOperation }
}

const DragSourceImpl = <T extends React.ElementType = 'div'>(
  {
    as,
    className,
    dragging,
    visual = 'source',
    preview = 'clone',
    previewVariant = 'surface',
    previewSizing = 'source',
    previewTargetRef,
    previewAxis = 'both',
    previewMotion = 'none',
    previewElevation = 'default',
    hideFromPreview = false,
    draggable = true,
    onDragStart,
    onDragEnd,
    onDragOperationChange,
    children,
    style,
    ...props
  }: DragSourceProps<T>,
  ref: React.ForwardedRef<HTMLElement>
): React.ReactElement => {
  const [internalDragging, setInternalDragging] = React.useState(false)
  const [internalDragOperation, setInternalDragOperation] = React.useState<DragOperation | null>(
    null
  )
  const dragOperationRef = React.useRef<DragOperation | null>(null)
  const dragOperationCleanupRef = React.useRef<(() => void) | null>(null)
  const previewCleanupRef = React.useRef<FloatingDragPreviewHandle | null>(null)
  React.useEffect(() => {
    return () => {
      dragOperationCleanupRef.current?.()
      dragOperationCleanupRef.current = null
      previewCleanupRef.current?.cleanup()
      previewCleanupRef.current = null
    }
  }, [])
  const Component = (as ?? 'div') as React.ElementType
  const isPreview = visual === 'preview'
  const isDragging = dragging ?? internalDragging
  const previewVariantClassName =
    previewVariant === 'content'
      ? 'data-[drag-visual=preview]:border-transparent data-[drag-visual=preview]:bg-transparent data-[drag-visual=preview]:opacity-100'
      : 'data-[drag-visual=preview]:border data-[drag-visual=preview]:border-[var(--drag-preview-border)] data-[drag-visual=preview]:bg-[var(--drag-preview-bg)] data-[drag-visual=preview]:opacity-90'
  const previewElevationClassName =
    previewElevation === 'strong'
      ? 'data-[drag-visual=preview]:shadow-2xl'
      : 'data-[drag-visual=preview]:shadow-lg'

  return (
    <Component
      ref={ref}
      draggable={isPreview ? false : draggable}
      data-dragging={isDragging ? 'true' : 'false'}
      data-drag-visual={visual}
      data-drag-operation={internalDragOperation ?? undefined}
      data-drag-preview-variant={previewVariant}
      data-drag-preview-sizing={previewSizing}
      data-drag-preview-target={previewTargetRef ? 'custom' : 'source'}
      data-drag-preview-axis={previewAxis}
      data-drag-preview-motion={previewMotion}
      data-drag-preview-elevation={previewElevation}
      data-drag-preview-ignore={hideFromPreview ? 'true' : undefined}
      className={cn(
        'relative cursor-grab transition-[opacity,box-shadow] duration-150 ease-out active:cursor-grabbing data-[dragging=true]:cursor-grabbing data-[dragging=true]:opacity-0',
        previewVariantClassName,
        previewElevationClassName,
        className
      )}
      style={style}
      onDragStart={(event: React.DragEvent<HTMLElement>) => {
        dragOperationCleanupRef.current?.()
        dragOperationCleanupRef.current = null
        previewCleanupRef.current?.cleanup()
        previewCleanupRef.current = null
        onDragStart?.(event)
        if (event.defaultPrevented) {
          setInternalDragging(false)
          setInternalDragOperation(null)
          dragOperationRef.current = null
          delete event.currentTarget.dataset.dragOperation
          return
        }
        const operation: DragOperation = onDragOperationChange && event.altKey ? 'copy' : 'move'
        const source = event.currentTarget
        dragOperationRef.current = operation
        source.dataset.dragOperation = operation
        setInternalDragOperation(operation)
        setInternalDragging(true)

        let floatingPreviewHandle: FloatingDragPreviewHandle | null = null
        if (!isPreview && preview === 'clone') {
          setCloneDragImage(event, previewSizing)
        } else if (!isPreview && preview === 'floating') {
          floatingPreviewHandle = createFloatingDragImage(event, {
            previewTarget: previewTargetRef?.current ?? event.currentTarget,
            previewSizing,
            previewAxis,
            previewMotion,
            previewElevation,
            previewVariant,
            hidePreviewDescendants: Boolean(previewTargetRef?.current && hideFromPreview)
          })
          previewCleanupRef.current = floatingPreviewHandle
        }

        if (!onDragOperationChange) {
          return
        }

        const updateOperation = (nextOperation: DragOperation): void => {
          if (dragOperationRef.current === nextOperation) {
            return
          }

          dragOperationRef.current = nextOperation
          source.dataset.dragOperation = nextOperation
          setInternalDragOperation(nextOperation)
          floatingPreviewHandle?.setOperation(nextOperation)
          onDragOperationChange?.(nextOperation)
        }
        const syncOperationFromModifier = (altKey: boolean): void => {
          updateOperation(altKey ? 'copy' : 'move')
        }
        const handleDrag = (dragEvent: DragEvent): void => {
          syncOperationFromModifier(dragEvent.altKey)
        }
        const handleDragOver = (dragEvent: DragEvent): void => {
          syncOperationFromModifier(dragEvent.altKey)
        }
        const handleModifierKey = (keyboardEvent: KeyboardEvent): void => {
          if (
            keyboardEvent.key !== 'Alt' &&
            keyboardEvent.key !== 'Option' &&
            keyboardEvent.code !== 'AltLeft' &&
            keyboardEvent.code !== 'AltRight'
          ) {
            return
          }

          syncOperationFromModifier(keyboardEvent.type === 'keydown')
        }
        const cleanupDragOperation = (): void => {
          source.removeEventListener('drag', handleDrag)
          window.removeEventListener('dragover', handleDragOver, true)
          window.removeEventListener('keydown', handleModifierKey, true)
          window.removeEventListener('keyup', handleModifierKey, true)
          window.removeEventListener('dragend', cleanupDragOperation, true)
          if (dragOperationCleanupRef.current === cleanupDragOperation) {
            dragOperationCleanupRef.current = null
          }
        }

        source.addEventListener('drag', handleDrag)
        window.addEventListener('dragover', handleDragOver, true)
        window.addEventListener('keydown', handleModifierKey, true)
        window.addEventListener('keyup', handleModifierKey, true)
        window.addEventListener('dragend', cleanupDragOperation, true)
        dragOperationCleanupRef.current = cleanupDragOperation
      }}
      onDragEnd={(event: React.DragEvent<HTMLElement>) => {
        setInternalDragging(false)
        setInternalDragOperation(null)
        dragOperationRef.current = null
        dragOperationCleanupRef.current?.()
        dragOperationCleanupRef.current = null
        delete event.currentTarget.dataset.dragOperation
        previewCleanupRef.current?.cleanup()
        previewCleanupRef.current = null
        onDragEnd?.(event)
      }}
      {...props}
    >
      {children}
    </Component>
  )
}

export const DragSource = React.forwardRef(DragSourceImpl) as DragSourceComponent
