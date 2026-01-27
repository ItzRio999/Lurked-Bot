import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function SortableThread({ id, isAdmin, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging ? "z-50" : ""}`}
    >
      {isAdmin && (
        <div
          {...attributes}
          {...listeners}
          className="absolute left-2 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing z-10 p-2 rounded-lg hover:bg-white/5 transition-colors duration-200"
          aria-label="Drag to reorder"
        >
          <iconify-icon
            icon="solar:menu-dots-linear"
            width="20"
            height="20"
            className="text-slate-500 hover:text-violet-400 transition-colors"
          ></iconify-icon>
        </div>
      )}
      <div className={isAdmin ? "ml-10" : ""}>{children}</div>
    </div>
  );
}
