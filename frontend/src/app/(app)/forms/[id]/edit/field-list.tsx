"use client";

import { useCallback } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CopyPlus,
  GripVertical,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  FIELD_TYPES,
  FIELD_TYPE_LABEL,
  defaultFieldForType,
  nextFieldId,
  type FieldType,
  type FormField,
} from "@/lib/schema/definition";

export function FieldList({
  fields,
  onFieldsChange,
  onSelectField,
  selectedFieldId,
}: {
  fields: FormField[];
  onFieldsChange: (next: FormField[]) => void;
  onSelectField: (id: string) => void;
  selectedFieldId: string | null;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      onFieldsChange(arrayMove(fields, oldIndex, newIndex));
    },
    [fields, onFieldsChange],
  );

  const addField = useCallback(
    (type: FieldType) => {
      const newField = defaultFieldForType(type, fields);
      onFieldsChange([...fields, newField]);
      onSelectField(newField.id);
    },
    [fields, onFieldsChange, onSelectField],
  );

  const duplicateField = useCallback(
    (id: string) => {
      const target = fields.find((f) => f.id === id);
      if (!target) return;
      const newId = nextFieldId(fields);
      const copy: FormField = {
        ...target,
        id: newId,
        label: `${target.label} (copy)`,
        ...(target.options ? { options: [...target.options] } : {}),
      };
      const idx = fields.findIndex((f) => f.id === id);
      const next = [...fields];
      next.splice(idx + 1, 0, copy);
      onFieldsChange(next);
    },
    [fields, onFieldsChange],
  );

  const removeField = useCallback(
    (id: string) => {
      onFieldsChange(fields.filter((f) => f.id !== id));
    },
    [fields, onFieldsChange],
  );

  return (
    <div className="space-y-3">
      {fields.length === 0 ? (
        <EmptyState />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={fields.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2">
              {fields.map((field) => (
                <SortableRow
                  key={field.id}
                  field={field}
                  selected={field.id === selectedFieldId}
                  onSelect={() => onSelectField(field.id)}
                  onDuplicate={() => duplicateField(field.id)}
                  onRemove={() => removeField(field.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <AddFieldMenu onPick={addField} />
    </div>
  );
}

function SortableRow({
  field,
  selected,
  onSelect,
  onDuplicate,
  onRemove,
}: {
  field: FormField;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-selected={selected}
      className={cn(
        "group/field flex items-center gap-2 rounded-lg border bg-card p-2 transition-colors",
        selected
          ? "border-brand/50 bg-brand-tint/50"
          : "border-border hover:bg-muted/40",
        isDragging && "shadow-lg",
      )}
    >
      <button
        type="button"
        className="flex h-8 w-6 cursor-grab items-center justify-center rounded text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="truncate text-sm font-medium">
          {field.label || "Untitled field"}
        </span>
        {field.required && (
          <span aria-label="Required" className="text-destructive">
            *
          </span>
        )}
        {field.needs_review && (
          <Badge variant="warning" className="gap-1">
            <Sparkles className="size-2.5" />
            Review
          </Badge>
        )}
      </button>

      <Badge variant="muted" className="hidden sm:inline-flex">
        {FIELD_TYPE_LABEL[field.type]}
      </Badge>

      <div className="flex items-center gap-0.5 opacity-0 group-hover/field:opacity-100 group-data-[selected=true]/field:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onSelect}
          aria-label="Edit field"
          title="Edit field"
        >
          <Settings2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDuplicate}
          aria-label="Duplicate field"
          title="Duplicate field"
        >
          <CopyPlus />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label="Delete field"
          title="Delete field"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

function AddFieldMenu({ onPick }: { onPick: (type: FieldType) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="w-full justify-center border-dashed font-mono-tech uppercase tracking-[0.15em] text-[11px]"
          />
        }
      >
        <Plus />
        Add field
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {FIELD_TYPES.map((type) => (
          <DropdownMenuItem key={type} onClick={() => onPick(type)}>
            {FIELD_TYPE_LABEL[type]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
      <p className="font-mono-tech uppercase tracking-[0.22em] text-[10px] text-muted-foreground">
        Empty form
      </p>
      <p className="mt-2 font-display text-lg">No fields yet.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Add a field below to get started, or re-run the sketch on a clearer
        photo.
      </p>
    </div>
  );
}
