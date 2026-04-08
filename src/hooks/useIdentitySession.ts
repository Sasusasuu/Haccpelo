import { useState, useCallback, useRef, useEffect } from "react";
import { Employee } from "@/hooks/useEmployees";

/**
 * Manages a temporary identity session.
 * Once identified, the user stays authenticated for `durationMinutes`.
 * After expiry, identity is cleared and re-identification is needed.
 */
export function useIdentitySession(durationMinutes: number = 5) {
  const [identifiedEmployee, setIdentifiedEmployee] = useState<Employee | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSession = useCallback(() => {
    setIdentifiedEmployee(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startSession = useCallback((employee: Employee) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIdentifiedEmployee(employee);
    timerRef.current = setTimeout(() => {
      setIdentifiedEmployee(null);
      timerRef.current = null;
    }, durationMinutes * 60 * 1000);
  }, [durationMinutes]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    identifiedEmployee,
    isIdentified: !!identifiedEmployee,
    startSession,
    clearSession,
  };
}
