"use client";

import { create } from "zustand";
import { makeId } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "error" | "info";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, "id">) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  push: (toast) => {
    const id = makeId("toast");
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }].slice(-4),
    }));
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
      }, toast.variant === "error" ? 7000 : 4500);
    }
    return id;
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

export function toast(input: {
  title: string;
  description?: string;
  variant?: ToastVariant;
}): string {
  return useToasts.getState().push({
    title: input.title,
    description: input.description,
    variant: input.variant ?? "default",
  });
}
