// JobWizard/hooks/useQualityScore.ts
"use client";

import { useMemo } from "react";
import { UseFormWatch } from "react-hook-form";
import { JobForm } from "../types";
import { QUALITY_THRESHOLDS } from "../constants";

export type QualityIssue = {
  type: "error" | "warning" | "info";
  message: string;
  step: number;
};

export type QualityScore = {
  overall: number; // 0-100
  completeness: number; // 0-100
  quality: number; // 0-100
  issues: QualityIssue[];
  suggestions: string[];
};

export function useQualityScore(watch: UseFormWatch<JobForm>): QualityScore {
  const formData = watch();

  return useMemo(() => {
    const issues: QualityIssue[] = [];
    const suggestions: string[] = [];
    let completenessScore = 0;
    let qualityScore = 0;

    // === COMPLETENESS (50 puntos) ===
    
    // Paso 1: Basic info (10 puntos)
    if (formData.title?.trim()) completenessScore += 5;
    if (formData.city?.trim() || formData.locationType === "REMOTE") completenessScore += 2.5;
    if (formData.salaryMin || formData.salaryMax) {
      completenessScore += 2.5;
    } else {
      issues.push({
        type: "warning",
        message: "Agregar rango salarial aumenta un 40% las postulaciones",
        step: 1,
      });
    }

    // Paso 2: Employment (5 puntos)
    if (formData.employmentType) completenessScore += 2.5;
    if (formData.schedule?.trim()) {
      completenessScore += 2.5;
    } else {
      suggestions.push("Agrega un horario de referencia para más claridad");
    }

    // Paso 3: Benefits (10 puntos)
    const benefitsCount = Object.values(formData.benefits || {}).filter(Boolean).length;
    if (benefitsCount >= QUALITY_THRESHOLDS.benefits.min) completenessScore += 5;
    if (benefitsCount >= QUALITY_THRESHOLDS.benefits.good) completenessScore += 5;
    
    if (benefitsCount < QUALITY_THRESHOLDS.benefits.min) {
      issues.push({
        type: "warning",
        message: `Solo ${benefitsCount} prestaciones. Recomendamos al menos ${QUALITY_THRESHOLDS.benefits.min}`,
        step: 3,
      });
    }

    // Paso 4: Description & Requirements (25 puntos)
    const descLength = formData.descriptionPlain?.replace(/\s+/g, "").length || 0;
    if (descLength >= QUALITY_THRESHOLDS.description.min) completenessScore += 8;
    if (descLength >= QUALITY_THRESHOLDS.description.good) completenessScore += 8;
    if (descLength >= QUALITY_THRESHOLDS.description.excellent) completenessScore += 9;

    const skillsCount = (formData.requiredSkills?.length || 0) + (formData.niceSkills?.length || 0);
    if (skillsCount >= QUALITY_THRESHOLDS.skills.min) completenessScore += 5;
    if (skillsCount >= QUALITY_THRESHOLDS.skills.good) completenessScore += 5;

    if (skillsCount < QUALITY_THRESHOLDS.skills.min) {
      issues.push({
        type: "error",
        message: `Solo ${skillsCount} skills. Mínimo recomendado: ${QUALITY_THRESHOLDS.skills.min}`,
        step: 4,
      });
    }

    if ((formData.eduRequired?.length || 0) + (formData.eduNice?.length || 0) > 0) {
      completenessScore += 5;
    } else {
      suggestions.push("Especifica requisitos educativos para filtrar mejor");
    }

    // === QUALITY (50 puntos) ===

    // Descripción detallada
    if (descLength >= QUALITY_THRESHOLDS.description.excellent) {
      qualityScore += 15;
    } else if (descLength >= QUALITY_THRESHOLDS.description.good) {
      qualityScore += 10;
    } else if (descLength >= QUALITY_THRESHOLDS.description.min) {
      qualityScore += 5;
      suggestions.push("Una descripción más detallada mejora la calidad de postulantes");
    }

    // Skills bien definidos
    const hasRequiredSkills = (formData.requiredSkills?.length || 0) > 0;
    const hasNiceSkills = (formData.niceSkills?.length || 0) > 0;
    
    if (hasRequiredSkills && hasNiceSkills) {
      qualityScore += 10;
    } else if (hasRequiredSkills) {
      qualityScore += 5;
      suggestions.push('Agrega skills "Deseables" para atraer más talento');
    }

    // Balance skills requeridos/deseables
    const requiredCount = formData.requiredSkills?.length || 0;
    const niceCount = formData.niceSkills?.length || 0;
    
    if (requiredCount > 8) {
      issues.push({
        type: "warning",
        message: "Demasiados requisitos obligatorios pueden limitar postulantes",
        step: 4,
      });
    } else if (requiredCount >= 3 && requiredCount <= 6) {
      qualityScore += 10;
    }

    // Sueldo competitivo
    if (formData.showSalary && (formData.salaryMin || formData.salaryMax)) {
      qualityScore += 10;
      if (!formData.salaryMin || !formData.salaryMax) {
        suggestions.push("Especifica rango completo de sueldo para más transparencia");
      }
    }

    // Prestaciones atractivas
    if (benefitsCount >= QUALITY_THRESHOLDS.benefits.excellent) {
      qualityScore += 5;
    } else if (benefitsCount >= QUALITY_THRESHOLDS.benefits.good) {
      qualityScore += 3;
    }

    // Idiomas especificados
    if ((formData.languages?.length || 0) > 0) {
      qualityScore += 5;
    } else if (formData.requiredSkills?.some(s => s.toLowerCase().includes('english') || s.toLowerCase().includes('inglés'))) {
      issues.push({
        type: "info",
        message: 'Considera especificar nivel de inglés en la sección "Idiomas"',
        step: 4,
      });
    }

    // Certificaciones
    if ((formData.certs?.length || 0) > 0) {
      qualityScore += 5;
    }

    const overall = Math.min(100, Math.round(completenessScore + qualityScore));

    // Sugerencia general
    if (overall < 60) {
      suggestions.push("🎯 Completa más secciones para mejorar la visibilidad de tu vacante");
    } else if (overall < 80) {
      suggestions.push("✨ ¡Vas bien! Algunos detalles más y tendrás una vacante excelente");
    } else if (overall >= 90) {
      suggestions.push("🚀 ¡Excelente! Esta vacante está muy completa");
    }

    return {
      overall,
      completeness: Math.min(100, completenessScore * 2),
      quality: Math.min(100, qualityScore * 2),
      issues,
      suggestions,
    };
  }, [formData]);
}
