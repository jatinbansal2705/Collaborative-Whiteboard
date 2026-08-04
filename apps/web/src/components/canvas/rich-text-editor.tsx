'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Underline,
} from 'lucide-react';
import type { TextElement } from '@whiteboard/shared';
import { useCameraStore } from '@/stores/camera-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { beginElementEdit, updateElementInPlace } from '@/lib/canvas/commands';
import {
  computeTextElementSize,
  htmlToRichText,
  normalizeParagraphs,
  richTextToHtml,
} from '@/lib/canvas/text';
import { cn } from '@/lib/utils';

const SYNC_DELAY_MS = 250;

/** In-canvas contentEditable editor for rich-text elements. */
export function RichTextEditor() {
  const element = useCanvasStore((state) =>
    state.elements.find((entry) => entry.id === state.editingId),
  );
  const stopEditing = useCanvasStore((state) => state.stopEditing);
  const zoom = useCameraStore((state) => state.zoom);
  const offsetX = useCameraStore((state) => state.offsetX);
  const offsetY = useCameraStore((state) => state.offsetY);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const syncTimerRef = useRef<number | null>(null);

  const isText = element !== undefined && element.type === 'text';
  const textElement = isText ? (element as TextElement) : undefined;

  const rect = useMemo(() => {
    if (textElement === undefined) {
      return null;
    }
    return {
      x: (textElement.x - offsetX) * zoom,
      y: (textElement.y - offsetY) * zoom,
      width: textElement.width * zoom,
      height: textElement.height * zoom,
      angle: textElement.angle,
    };
  }, [textElement, zoom, offsetX, offsetY]);

  const commitText = useCallback(
    (html: string) => {
      if (textElement === undefined) {
        return;
      }
      const paragraphs = normalizeParagraphs(htmlToRichText(html));
      const size = computeTextElementSize(paragraphs, {
        fontFamily: textElement.fontFamily,
        fontSize: textElement.fontSize,
        lineHeight: textElement.lineHeight,
        color: textElement.color,
        autoWidth: textElement.autoWidth,
        width: textElement.width,
      });
      updateElementInPlace(textElement.id, (current) => ({
        ...current,
        paragraphs,
        width: size.width,
        height: size.height,
      }));
    },
    [textElement],
  );

  const queueSync = useCallback(() => {
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null;
      const html = editorRef.current?.innerHTML ?? '';
      commitText(html);
    }, SYNC_DELAY_MS);
  }, [commitText]);

  useEffect(() => {
    if (textElement === undefined) {
      return;
    }
    beginElementEdit();
    const editor = editorRef.current;
    if (editor !== null) {
      editor.innerHTML = richTextToHtml(textElement.paragraphs);
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    return () => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
    // Mount/session identity only: sync once when the edited element changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textElement?.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        stopEditing();
      }
    };
    const editor = editorRef.current;
    editor?.addEventListener('keydown', onKeyDown);
    return () => editor?.removeEventListener('keydown', onKeyDown);
  }, [stopEditing]);

  function execCommand(command: string, value?: string): void {
    const editor = editorRef.current;
    if (editor === null) {
      return;
    }
    editor.focus();
    document.execCommand(command, false, value);
    queueSync();
  }

  if (textElement === undefined || rect === null) {
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
          top: rect.y - 44 * Math.min(1, zoom),
          transform: `translateY(-2px)`,
        }}
      >
        <div className="flex items-center gap-0.5 rounded-md border bg-background/95 p-1 shadow-md backdrop-blur">
          <ToolButton
            icon={<Bold className="size-3.5" aria-hidden="true" />}
            label="Bold"
            onClick={() => execCommand('bold')}
          />
          <ToolButton
            icon={<Italic className="size-3.5" aria-hidden="true" />}
            label="Italic"
            onClick={() => execCommand('italic')}
          />
          <ToolButton
            icon={<Underline className="size-3.5" aria-hidden="true" />}
            label="Underline"
            onClick={() => execCommand('underline')}
          />
          <span className="mx-0.5 h-4 w-px bg-border" />
          <ToolButton
            icon={<AlignLeft className="size-3.5" aria-hidden="true" />}
            label="Align left"
            onClick={() => execCommand('justifyLeft')}
          />
          <ToolButton
            icon={<AlignCenter className="size-3.5" aria-hidden="true" />}
            label="Align center"
            onClick={() => execCommand('justifyCenter')}
          />
          <ToolButton
            icon={<AlignRight className="size-3.5" aria-hidden="true" />}
            label="Align right"
            onClick={() => execCommand('justifyRight')}
          />
          <span className="mx-0.5 h-4 w-px bg-border" />
          <ToolButton
            icon={<List className="size-3.5" aria-hidden="true" />}
            label="Bullet list"
            onClick={() => execCommand('insertUnorderedList')}
          />
          <ToolButton
            icon={<ListOrdered className="size-3.5" aria-hidden="true" />}
            label="Numbered list"
            onClick={() => execCommand('insertOrderedList')}
          />
        </div>
      </div>
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
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onInput={queueSync}
          onPaste={queueSync}
          onPointerDown={(event) => event.stopPropagation()}
          className="h-full w-full overflow-hidden whitespace-pre-wrap outline-none"
          style={{
            fontFamily: textElement.fontFamily,
            fontSize: `${textElement.fontSize * zoom}px`,
            lineHeight: textElement.lineHeight,
            color: textElement.color,
          }}
        />
      </div>
    </>
  );
}

function ToolButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'flex size-6 items-center justify-center rounded text-muted-foreground outline-none transition-colors',
        'hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {icon}
    </button>
  );
}
