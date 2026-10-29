import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Unlink } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "~/lib/utils";

/**
 * Small rich text editor (Tiptap) limited to bold, italic, links, bullet and
 * ordered lists and h2/h3. Emits HTML ("" when empty). The HTML must be
 * sanitised server-side on save (see app/server/sanitize.server.ts).
 *
 * Controlled: external `value` changes (e.g. undo/redo) are pushed into the
 * editor when they differ from its current content.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  label,
  className,
  minHeight = 96,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Accessible label for the editable region. */
  label?: string;
  className?: string;
  minHeight?: number;
}) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
        },
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "os-prose min-h-[inherit] px-3 py-2 text-sm text-ink focus:outline-none",
        ...(label ? { "aria-label": label } : {}),
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: e }) => onChangeRef.current(toHtml(e)),
  });

  // Push external changes (undo/redo, switching tiers) into the editor.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if ((value || "") !== toHtml(editor)) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  const isEmpty = useEditorState({ editor, selector: (s) => s.editor?.isEmpty ?? !value }) ?? !value;

  return (
    <div
      className={cn(
        "rounded-md border border-gray-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20",
        className,
      )}
    >
      <Toolbar editor={editor} />
      <div className="relative" style={{ minHeight }}>
        {isEmpty && placeholder && (
          <span className="pointer-events-none absolute left-3 top-2 text-sm text-gray-400">{placeholder}</span>
        )}
        {editor ? (
          <EditorContent editor={editor} style={{ minHeight }} />
        ) : (
          <div
            className="os-prose px-3 py-2 text-sm text-ink"
            style={{ minHeight }}
            dangerouslySetInnerHTML={{ __html: value }}
          />
        )}
      </div>
    </div>
  );
}

function toHtml(editor: Editor): string {
  return editor.isEmpty ? "" : editor.getHTML();
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            link: e.isActive("link"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
          }
        : null,
  });
  const chain = () => editor!.chain().focus();
  const disabled = !editor;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 px-1 py-1" role="toolbar" aria-label="Formatting">
      <ToolButton label="Bold" active={state?.bold} disabled={disabled} onClick={() => chain().toggleBold().run()}>
        <Bold />
      </ToolButton>
      <ToolButton label="Italic" active={state?.italic} disabled={disabled} onClick={() => chain().toggleItalic().run()}>
        <Italic />
      </ToolButton>
      <LinkButton editor={editor} active={!!state?.link} />
      <span className="mx-1 h-4 w-px bg-gray-200" aria-hidden />
      <ToolButton label="Heading" active={state?.h2} disabled={disabled} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        <Heading2 />
      </ToolButton>
      <ToolButton label="Subheading" active={state?.h3} disabled={disabled} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
        <Heading3 />
      </ToolButton>
      <ToolButton label="Bulleted list" active={state?.bullet} disabled={disabled} onClick={() => chain().toggleBulletList().run()}>
        <List />
      </ToolButton>
      <ToolButton label="Numbered list" active={state?.ordered} disabled={disabled} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered />
      </ToolButton>
    </div>
  );
}

function ToolButton({
  label,
  active,
  className,
  ...props
}: React.ComponentProps<"button"> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={!!active}
      className={cn(
        "grid size-7 place-items-center rounded text-gray-600 hover:bg-gray-100 hover:text-ink disabled:opacity-40 [&_svg]:size-4",
        active && "bg-brand-50 text-brand-700 hover:bg-brand-100",
        className,
      )}
      {...props}
    />
  );
}

function LinkButton({ editor, active }: { editor: Editor | null; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const inputId = useId();

  const apply = () => {
    if (!editor) return;
    const url = href.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const full = /^(https?:|mailto:|tel:)/i.test(url) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href: full }).run();
    }
    setOpen(false);
  };

  return (
    <>
      <Popover.Root
        open={open}
        onOpenChange={(o) => {
          if (o && editor) setHref((editor.getAttributes("link").href as string | undefined) ?? "");
          setOpen(o);
        }}
      >
        <Popover.Trigger asChild>
          <ToolButton label={active ? "Edit link" : "Add link"} active={active} disabled={!editor}>
            <Link2 />
          </ToolButton>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={6}
            align="start"
            className="z-50 w-72 rounded-md border border-gray-200 bg-white p-3 shadow-lg"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                apply();
              }}
            >
              <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-gray-700">
                Link URL
              </label>
              <div className="flex gap-2">
                <input
                  id={inputId}
                  autoFocus
                  value={href}
                  onChange={(e) => setHref(e.target.value)}
                  placeholder="https://example.com"
                  className="h-8 w-full rounded-md border border-gray-300 px-2 text-sm focus:border-brand-500 focus:outline-none"
                />
                <button type="submit" className="h-8 rounded-md bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700">
                  Apply
                </button>
              </div>
            </form>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {active && (
        <ToolButton label="Remove link" onClick={() => editor?.chain().focus().extendMarkRange("link").unsetLink().run()}>
          <Unlink />
        </ToolButton>
      )}
    </>
  );
}
