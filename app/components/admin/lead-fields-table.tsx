import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "~/components/ui/dialog";
import { Field, Input, Select, Textarea } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { newId } from "~/lib/scorecard/defaults";
import type { LeadField } from "~/lib/scorecard/schema";
import { cn } from "~/lib/utils";
import { Checkbox } from "./form-bits";

export const LEAD_FIELD_TYPES: { value: LeadField["type"]; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
];

const typeLabel = (t: LeadField["type"]) => LEAD_FIELD_TYPES.find((x) => x.value === t)?.label ?? t;

const GRID = "grid grid-cols-[32px_minmax(0,1fr)_110px_80px_80px_76px] items-center gap-2";

function Row({
  field,
  onChange,
  onEdit,
  onDelete,
}: {
  field: LeadField;
  onChange: (f: LeadField) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        GRID,
        "border-t border-gray-200 bg-white px-3 py-2.5 text-[15px]",
        isDragging && "relative z-10 shadow-lg",
        !field.enabled && "text-gray-400",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="grid size-7 cursor-grab place-items-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing"
        aria-label={`Reorder ${field.label}`}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="truncate">
        {field.label || <span className="italic text-gray-400">Untitled</span>}
        {field.builtIn && <span className="ml-2 text-xs text-gray-400">Default</span>}
      </span>
      <span className="text-sm text-gray-600">{typeLabel(field.type)}</span>
      <span className="text-center text-sm">{field.required ? "Yes" : "No"}</span>
      <span className="flex justify-center">
        <Switch
          checked={field.enabled}
          onCheckedChange={(enabled) => onChange({ ...field, enabled })}
          aria-label={`Show ${field.label}`}
        />
      </span>
      <span className="flex justify-end gap-0.5">
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Edit ${field.label}`}>
          <Pencil />
        </Button>
        {!field.builtIn && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            aria-label={`Delete ${field.label}`}
            className="hover:text-red-600"
          >
            <Trash2 />
          </Button>
        )}
      </span>
    </div>
  );
}

function FieldDialog({
  field,
  open,
  onOpenChange,
  onSave,
}: {
  field: LeadField | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (f: LeadField) => void;
}) {
  const [draft, setDraft] = useState<LeadField>(() => field ?? newField());
  const [optionsText, setOptionsText] = useState(() => (field?.options ?? []).join("\n"));
  const [error, setError] = useState<string | null>(null);
  const isNew = !field;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const options = optionsText
      .split("\n")
      .map((o) => o.trim())
      .filter(Boolean);
    if (!draft.label.trim()) return setError("Give the field a label.");
    if (draft.type === "select" && options.length === 0) return setError("Add at least one option.");
    onSave({ ...draft, label: draft.label.trim(), options: draft.type === "select" ? options : [] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={isNew ? "Add field" : `Edit "${field.label}"`}>
        <form onSubmit={submit}>
          <DialogBody className="space-y-4">
            <Field label="Label" htmlFor="lf-label" error={error}>
              <Input
                id="lf-label"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="e.g. Company name"
                autoFocus
              />
            </Field>
            <Field label="Type" htmlFor="lf-type" hint={draft.builtIn ? "Default fields keep their type." : undefined}>
              <Select
                id="lf-type"
                value={draft.type}
                disabled={draft.builtIn}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as LeadField["type"] })}
              >
                {LEAD_FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            {draft.type === "select" && (
              <Field label="Options" htmlFor="lf-options" hint="One option per line.">
                <Textarea
                  id="lf-options"
                  rows={4}
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder={"1–10 employees\n11–50 employees\n51+ employees"}
                />
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <Checkbox checked={draft.required} onChange={(e) => setDraft({ ...draft, required: e.target.checked })} />
              {draft.type === "checkbox" ? "Must be ticked to continue" : "Required"}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <Checkbox checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
              Show this field on the form
            </label>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isNew ? "Add field" : "Done"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function newField(): LeadField {
  const id = newId();
  return {
    id,
    key: `custom_${id}`,
    label: "",
    type: "text",
    required: false,
    enabled: true,
    builtIn: false,
    options: [],
  };
}

/** Sortable lead form fields table with add / edit / delete (019.png). */
export function LeadFieldsTable({
  fields,
  onChange,
}: {
  fields: LeadField[];
  onChange: (fields: LeadField[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [dialog, setDialog] = useState<{ open: boolean; field: LeadField | null; key: number }>({
    open: false,
    field: null,
    key: 0,
  });

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = fields.findIndex((f) => f.id === active.id);
    const to = fields.findIndex((f) => f.id === over.id);
    onChange(arrayMove(fields, from, to));
  };

  const save = (f: LeadField) =>
    onChange(fields.some((x) => x.id === f.id) ? fields.map((x) => (x.id === f.id ? f : x)) : [...fields, f]);

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className={cn(GRID, "px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-gray-500")}>
          <span />
          <span>Label</span>
          <span>Type</span>
          <span className="text-center">Required</span>
          <span className="text-center">Shown</span>
          <span />
        </div>
        <DndContext id="lead-fields" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            {fields.map((f) => (
              <Row
                key={f.id}
                field={f}
                onChange={(next) => onChange(fields.map((x) => (x.id === f.id ? next : x)))}
                onEdit={() => setDialog((d) => ({ open: true, field: f, key: d.key + 1 }))}
                onDelete={() => {
                  if (confirm(`Delete the "${f.label}" field? Answers already collected stay on existing responses.`)) {
                    onChange(fields.filter((x) => x.id !== f.id));
                  }
                }}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <Button
        variant="link"
        className="mt-3 px-3"
        onClick={() => setDialog((d) => ({ open: true, field: null, key: d.key + 1 }))}
      >
        <Plus /> Add Field
      </Button>
      <FieldDialog
        key={dialog.key}
        field={dialog.field}
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onSave={save}
      />
    </div>
  );
}
