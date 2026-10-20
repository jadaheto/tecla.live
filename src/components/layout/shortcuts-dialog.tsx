"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUi } from "@/stores/ui";

const SHORTCUTS = [
  { keys: "⌘ / Ctrl + K", label: "Abrir o cerrar la búsqueda universal" },
  { keys: "⌘ / Ctrl + J", label: "Abrir TECLA AI" },
  { keys: "?", label: "Mostrar esta ayuda" },
  { keys: "Esc", label: "Cerrar paneles y diálogos" },
  { keys: "Enter", label: "Enviar mensaje a TECLA AI" },
  { keys: "Shift + Enter", label: "Nueva línea en el mensaje" },
];

export function ShortcutsDialog() {
  const open = useUi((state) => state.shortcutsOpen);
  const setOpen = useUi((state) => state.setShortcutsOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atajos de TECLA LIVE</DialogTitle>
          <DialogDescription>
            Pensados para teclado. En el Tesla todo está disponible con toques.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.keys}
              className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-border bg-surface/40 px-3.5"
            >
              <span className="text-xs text-muted">{shortcut.label}</span>
              <kbd className="shrink-0 rounded-md border border-border bg-surface px-2 py-1 font-mono text-[10px] text-foreground">
                {shortcut.keys}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[10px] leading-relaxed text-muted">
          El micrófono requiere permiso explícito. La conversación no se guarda en el servidor.
        </p>
      </DialogContent>
    </Dialog>
  );
}
