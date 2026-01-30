// JobWizard/hooks/useAutosave.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { UseFormWatch } from "react-hook-form";
import { JobForm } from "../types";

const AUTOSAVE_DELAY = 10000; // 10 segundos
const STORAGE_KEY = "job_wizard_draft";

export function useAutosave(watch: UseFormWatch<JobForm>, jobId?: string) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const subscription = watch((formData) => {
      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        setIsSaving(true);
        try {
          const key = jobId ? `${STORAGE_KEY}_${jobId}` : STORAGE_KEY;
          localStorage.setItem(key, JSON.stringify(formData));
          setLastSaved(new Date());
        } catch (error) {
          console.error("Error saving draft:", error);
        } finally {
          setIsSaving(false);
        }
      }, AUTOSAVE_DELAY);
    });

    return () => {
      subscription.unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [watch, jobId]);

  const loadDraft = () => {
    try {
      const key = jobId ? `${STORAGE_KEY}_${jobId}` : STORAGE_KEY;
      const saved = localStorage.getItem(key);
      if (!saved) return null;
      
      const parsed = JSON.parse(saved);
      // Verificar que el draft tiene datos válidos
      if (parsed && typeof parsed === 'object' && parsed.title) {
        return parsed;
      }
      return null;
    } catch (error) {
      console.error("Error loading draft:", error);
      return null;
    }
  };

  const clearDraft = () => {
    try {
      const key = jobId ? `${STORAGE_KEY}_${jobId}` : STORAGE_KEY;
      localStorage.removeItem(key);
      setLastSaved(null);
    } catch (error) {
      console.error("Error clearing draft:", error);
    }
  };

  return {
    lastSaved,
    isSaving,
    loadDraft,
    clearDraft,
  };
}