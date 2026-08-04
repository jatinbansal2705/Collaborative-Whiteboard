'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { StickyElement } from '@whiteboard/shared';
import { useCameraStore } from '@/stores/camera-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { beginElementEdit, updateElementInPlace } from '@/lib/canvas/commands';
import { computeStickySize } from '@/lib/canvas/text';

/** In-canvas textarea editor for sticky notes. */
export function StickyEditor() {
  const element = useCanvasStore((state) =>
    state.elements.find((entry) => entry.id === state.editingId),
  );
  const stopEditing = useCanvasStore((state) => state.stopEditing);
  const zoom = useCameraStore((state) => state.zoom);
  const offsetX = useCameraStore((state) => state.offsetX);
  const offsetY = useCameraStore((state) => state.offsetY);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isSticky = element !== undefined && element.type === 'sticky';
  const stickyElement = isSticky ? (element as StickyElement) : undefined;

  const rect = useMemo(() => {
    if (stickyElement === undefined) {
      return null;
    }
    return {
      x: (stickyElement.x - offsetX) * zoom,
      y: (stickyElement.y - offsetY) * zoom,
      width: stickyElement.width * zoom,
      height: stickyElement.height * zoom,
      angle: stickyElement.angle,
    };
  }, [stickyElement, zoom, offsetX, offsetY]);

  const commitText = useCallback(
    (text: string) => {
      if (stickyElement === undefined) {
        return;
      }
      const size = computeStickySize(
        text,
        stickyElement.width,
        stickyElement.fontSize,
      );
      updateElementInPlace(stickyElement.id, (current) => ({
        ...current,
        text,
        height: size.height,
      }));
    },
    [stickyElement],
  );

  useEffect(() => {
    if (stickyElement === undefined) {
      return;
    }
    beginElementEdit();
    const textarea = textareaRef.current;
    if (textarea !== null) {
      textarea.focus();
      textarea.select();
    }
    // Mount/session identity only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stickyElement?.id]);

  if (stickyElement === undefined || rect === null) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-30"
        onPointerDown={stopEditing}
        aria-hidden="true"
      />
      <div
        className="absolute z-40"
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          transform: `rotate(${rect.angle}deg)`,
        }}
      >
        <textarea
          ref={textareaRef}
          value={stickyElement.text}
          onChange={(event) => {
            commitText(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              stopEditing();
            }
          }}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label="Sticky note text"
          className="h-full w-full resize-none overflow-hidden rounded-sm bg-transparent p-3.5 text-left outline-none"
          style={{
            fontFamily: 'Inter',
            fontSize: `${stickyElement.fontSize * zoom}px`,
            lineHeight: 1.35,
            color: stickyElement.strokeColor,
          }}
        />
      </div>
    </>
  );
}
