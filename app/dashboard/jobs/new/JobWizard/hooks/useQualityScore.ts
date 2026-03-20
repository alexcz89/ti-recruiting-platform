// JobWizard/hooks/useQualityScore.ts
"use client";

import { useMemo } from "react";
import { UseFormWatch } from "react-hook-form";
import { JobForm } from "../types";
import { QUALITY_THRESHOLDS } from "../constants";
import { getJobQualitySummary } from "../utils/helpers";

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
    const summary = getJobQualitySummary(formData);
    const issues: QualityIssue[] = [];
    const suggestions: string[] = [];

    const benefitsCount = Object.values(formData.benefits || {}).filter(Boolean).length;
    const descLength = formData.descriptionPlain?.replace(/\s+/g, "").length || 0;
    const skillsCount =
      (formData.requiredSkills?.length || 0) + (formData.niceSkills?.length || 0);

    const requiredCount = formData.requiredSkills?.length || 0;
    const niceCount = formData.niceSkills?.length || 0;

    const hasValidSalaryValue = (value: unknown) => {
      if (typeof value === "number" && !Number.isNaN(value)) return true;
      if (typeof value === "string" && value.trim()) {
        const n = Number(value);
        return !Number.isNaN(n);
      }
      return false;
    };

    const hasTitle = !!formData.title?.trim();
    const hasLocation = !!formData.city?.trim() || formData.locationType === "REMOTE";
    const hasSalary =
      hasValidSalaryValue(formData.salaryMin) ||
      hasValidSalaryValue(formData.salaryMax);
    const hasSchedule = !!formData.schedule?.trim();
    const hasEducation =
      (formData.eduRequired?.length || 0) + (formData.eduNice?.length || 0) > 0;
    const hasLanguages = (formData.languages?.length || 0) > 0;
    const hasCerts = (formData.certs?.length || 0) > 0;
    const hasAssessment = !!formData.assessmentTemplateId;
    const hasRequiredSkills = requiredCount > 0;
    const hasNiceSkills = niceCount > 0;
    const hasMinDegree = !!formData.minDegree;
    const hasBenefits = benefitsCount > 0;
    const showSalary = !!formData.showSalary;

    if (!hasSalary) {
      issues.push({
        type: "warning",
        message: "Agregar rango salarial aumenta un 40% las postulaciones",
        step: 1,
      });
    }

    if (!hasSchedule) {
      suggestions.push("Agrega un horario de referencia para más claridad");
    }

    if (benefitsCount < QUALITY_THRESHOLDS.benefits.min) {
      issues.push({
        type: "warning",
        message: `Solo ${benefitsCount} prestaciones. Recomendamos al menos ${QUALITY_THRESHOLDS.benefits.min}`,
        step: 3,
      });
    }

    if (descLength < QUALITY_THRESHOLDS.description.min) {
      issues.push({
        type: "warning",
        message: `La descripción es corta. Recomendado mínimo: ${QUALITY_THRESHOLDS.description.min} caracteres útiles`,
        step: 4,
      });
    } else if (descLength < QUALITY_THRESHOLDS.description.good) {
      suggestions.push("Una descripción más detallada mejora la calidad de postulantes");
    }

    if (skillsCount < QUALITY_THRESHOLDS.skills.min) {
      issues.push({
        type: "error",
        message: `Solo ${skillsCount} skills. Mínimo recomendado: ${QUALITY_THRESHOLDS.skills.min}`,
        step: 4,
      });
    }

    if (!hasEducation) {
      suggestions.push("Especifica carreras o programas recomendados para filtrar mejor");
    }

    if (!hasMinDegree) {
      suggestions.push("Define un nivel académico mínimo para mejorar el filtrado");
    }

    if (hasRequiredSkills && !hasNiceSkills) {
      suggestions.push('Agrega skills "Deseables" para atraer más talento');
    }

    if (requiredCount > 8) {
      issues.push({
        type: "warning",
        message: "Demasiados requisitos obligatorios pueden limitar postulantes",
        step: 4,
      });
    }

    if (showSalary && hasSalary) {
      if (
        !hasValidSalaryValue(formData.salaryMin) ||
        !hasValidSalaryValue(formData.salaryMax)
      ) {
        suggestions.push("Especifica rango completo de sueldo para más transparencia");
      }
    } else if (!showSalary && hasSalary) {
      suggestions.push("Mostrar el sueldo puede mejorar la conversión de candidatos");
    }

    if (
      !hasLanguages &&
      formData.requiredSkills?.some(
        (s) =>
          s.toLowerCase().includes("english") ||
          s.toLowerCase().includes("inglés") ||
          s.toLowerCase().includes("ingles")
      )
    ) {
      issues.push({
        type: "info",
        message: 'Considera especificar nivel de inglés en la sección "Idiomas"',
        step: 4,
      });
    }

    if (!hasAssessment) {
      suggestions.push("Agregar una evaluación técnica puede ayudarte a filtrar mejor");
    }

    let completeness = 0;
    if (hasTitle) completeness += 15;
    if (hasLocation) completeness += 10;
    if (hasSalary) completeness += 15;
    if (hasSchedule) completeness += 5;
    if (descLength >= QUALITY_THRESHOLDS.description.min) completeness += 20;
    if (skillsCount >= QUALITY_THRESHOLDS.skills.min) completeness += 20;
    if (hasEducation || hasMinDegree) completeness += 10;
    if (hasBenefits) completeness += 5;

    let quality = 0;
    if (descLength >= QUALITY_THRESHOLDS.description.excellent) quality += 20;
    else if (descLength >= QUALITY_THRESHOLDS.description.good) quality += 14;
    else if (descLength >= QUALITY_THRESHOLDS.description.min) quality += 8;

    if (hasRequiredSkills && hasNiceSkills) quality += 15;
    else if (hasRequiredSkills) quality += 8;

    if (requiredCount >= 3 && requiredCount <= 6) quality += 10;

    if (showSalary && hasSalary) quality += 10;
    else if (hasSalary) quality += 5;

    if (benefitsCount >= QUALITY_THRESHOLDS.benefits.excellent) quality += 10;
    else if (benefitsCount >= QUALITY_THRESHOLDS.benefits.good) quality += 6;
    else if (benefitsCount >= QUALITY_THRESHOLDS.benefits.min) quality += 3;

    if (hasLanguages) quality += 5;
    if (hasCerts) quality += 5;
    if (hasAssessment) quality += 10;
    if (hasMinDegree) quality += 5;
    if (hasEducation) quality += 5;

    completeness = Math.min(100, Math.round(completeness));
    quality = Math.min(100, Math.round(quality));

    const overall = summary.score;

    if (overall < 60) {
      suggestions.push("Completa más secciones para mejorar la visibilidad de tu vacante");
    } else if (overall < 80) {
      suggestions.push("Vas bien. Algunos detalles más y tendrás una vacante más sólida");
    } else if (overall >= 90) {
      suggestions.push("Excelente. Esta vacante está muy completa");
    }

    return {
      overall,
      completeness,
      quality,
      issues,
      suggestions,
    };
  }, [formData]);
}