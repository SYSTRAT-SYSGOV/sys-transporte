import { useState } from "react";

import { ApiError } from "../api/client";

export function errorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Ocorreu um erro inesperado";
}

export function fieldError(error: unknown, field: string): string | undefined {
  if (error instanceof ApiError) {
    return error.errors.find((item) => item.field === field)?.message;
  }
  return undefined;
}

export function useSearch(initial = "") {
  const [input, setInput] = useState(initial);
  const [committed, setCommitted] = useState(initial);

  return {
    input,
    setInput,
    committed,
    submit: () => setCommitted(input.trim()),
  };
}
