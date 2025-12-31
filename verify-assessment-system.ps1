# verify-assessment-system.ps1
# Script de verificación para el sistema de assessments

Write-Host "🔍 VERIFICANDO INSTALACIÓN DEL SISTEMA DE ASSESSMENTS" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host ""

$errors = @()
$warnings = @()
$success = @()

# Función para verificar archivo
function Test-FileExists {
    param (
        [string]$Path,
        [string]$Description
    )
    
    if (Test-Path $Path) {
        Write-Host "✅ $Description" -ForegroundColor Green
        $script:success += $Description
        return $true
    } else {
        Write-Host "❌ FALTA: $Description" -ForegroundColor Red
        Write-Host "   Ruta: $Path" -ForegroundColor Yellow
        $script:errors += $Description
        return $false
    }
}

# Función para verificar carpeta
function Test-DirectoryExists {
    param (
        [string]$Path,
        [string]$Description
    )
    
    if (Test-Path $Path -PathType Container) {
        Write-Host "✅ $Description" -ForegroundColor Green
        $script:success += $Description
        return $true
    } else {
        Write-Host "⚠️  FALTA CARPETA: $Description" -ForegroundColor Yellow
        Write-Host "   Ruta: $Path" -ForegroundColor Yellow
        $script:warnings += $Description
        return $false
    }
}

Write-Host "📊 VERIFICANDO BASE DE DATOS" -ForegroundColor Cyan
Write-Host "-" * 60 -ForegroundColor Gray

# Verificar schema.prisma
if (Test-Path "prisma\schema.prisma") {
    $schema = Get-Content "prisma\schema.prisma" -Raw
    
    if ($schema -match "model AssessmentTemplate") {
        Write-Host "✅ Schema: AssessmentTemplate encontrado" -ForegroundColor Green
        $success += "Schema: AssessmentTemplate"
    } else {
        Write-Host "❌ Schema: Falta modelo AssessmentTemplate" -ForegroundColor Red
        $errors += "Schema: AssessmentTemplate"
    }
    
    if ($schema -match "model AssessmentQuestion") {
        Write-Host "✅ Schema: AssessmentQuestion encontrado" -ForegroundColor Green
        $success += "Schema: AssessmentQuestion"
    } else {
        Write-Host "❌ Schema: Falta modelo AssessmentQuestion" -ForegroundColor Red
        $errors += "Schema: AssessmentQuestion"
    }
    
    if ($schema -match "model AssessmentAttempt") {
        Write-Host "✅ Schema: AssessmentAttempt encontrado" -ForegroundColor Green
        $success += "Schema: AssessmentAttempt"
    } else {
        Write-Host "❌ Schema: Falta modelo AssessmentAttempt" -ForegroundColor Red
        $errors += "Schema: AssessmentAttempt"
    }
} else {
    Write-Host "❌ No se encontró prisma\schema.prisma" -ForegroundColor Red
    $errors += "prisma\schema.prisma"
}

Write-Host ""
Write-Host "🔌 VERIFICANDO API ROUTES" -ForegroundColor Cyan
Write-Host "-" * 60 -ForegroundColor Gray

# API Routes de Assessments
Test-FileExists "app\api\assessments\route.ts" "API: GET /api/assessments"
Test-FileExists "app\api\assessments\[templateId]\route.ts" "API: GET /api/assessments/[templateId]"
Test-FileExists "app\api\assessments\[templateId]\start\route.ts" "API: POST /api/assessments/[templateId]/start"
Test-FileExists "app\api\assessments\attempts\[attemptId]\answer\route.ts" "API: POST .../answer"
Test-FileExists "app\api\assessments\attempts\[attemptId]\submit\route.ts" "API: POST .../submit"
Test-FileExists "app\api\assessments\attempts\[attemptId]\results\route.ts" "API: GET .../results"
Test-FileExists "app\api\assessments\attempts\[attemptId]\flags\route.ts" "API: PATCH .../flags"

# API Routes de Jobs
Test-FileExists "app\api\jobs\[id]\assessments\route.ts" "API: Jobs assessments"
Test-FileExists "app\api\jobs\[id]\assessments\[assessmentId]\route.ts" "API: Delete job assessment"

Write-Host ""
Write-Host "🎨 VERIFICANDO COMPONENTES UI" -ForegroundColor Cyan
Write-Host "-" * 60 -ForegroundColor Gray

# Componentes de Assessment
Test-DirectoryExists "app\assessments\[templateId]" "Carpeta: app\assessments\[templateId]"
Test-FileExists "app\assessments\[templateId]\page.tsx" "Página: Tomar assessment"
Test-FileExists "app\assessments\[templateId]\AssessmentIntro.tsx" "Componente: AssessmentIntro"
Test-FileExists "app\assessments\[templateId]\AssessmentQuestion.tsx" "Componente: AssessmentQuestion"
Test-FileExists "app\assessments\[templateId]\AssessmentProgress.tsx" "Componente: AssessmentProgress"
Test-FileExists "app\assessments\[templateId]\AssessmentTimer.tsx" "Componente: AssessmentTimer"
Test-FileExists "app\assessments\[templateId]\useAntiCheating.ts" "Hook: useAntiCheating"

# Resultados
Test-FileExists "app\assessments\attempts\[attemptId]\results\page.tsx" "Página: Resultados"

# Dashboard Reclutador
Test-FileExists "app\dashboard\assessments\page.tsx" "Dashboard: Assessments (Reclutador)"

# Dashboard Candidato
Test-FileExists "app\mis-evaluaciones\page.tsx" "Página: Mis Evaluaciones"

# Componente de asignación
Test-FileExists "app\dashboard\jobs\[id]\assessments\AssignAssessmentForm.tsx" "Componente: AssignAssessmentForm"

# Componente de requisito
Test-FileExists "app\jobs\[id]\AssessmentRequirement.tsx" "Componente: AssessmentRequirement"

Write-Host ""
Write-Host "📦 VERIFICANDO DEPENDENCIAS" -ForegroundColor Cyan
Write-Host "-" * 60 -ForegroundColor Gray

if (Test-Path "package.json") {
    $package = Get-Content "package.json" -Raw | ConvertFrom-Json
    
    if ($package.dependencies.sonner) {
        Write-Host "✅ Dependencia: sonner instalada ($($package.dependencies.sonner))" -ForegroundColor Green
        $success += "Dependencia: sonner"
    } else {
        Write-Host "⚠️  FALTA: sonner no está instalada" -ForegroundColor Yellow
        Write-Host "   Ejecuta: npm install sonner" -ForegroundColor Yellow
        $warnings += "Dependencia: sonner"
    }
} else {
    Write-Host "❌ No se encontró package.json" -ForegroundColor Red
    $errors += "package.json"
}

Write-Host ""
Write-Host "🔧 VERIFICANDO ARCHIVOS AUXILIARES" -ForegroundColor Cyan
Write-Host "-" * 60 -ForegroundColor Gray

# Verificar lib/prisma.ts
if (Test-Path "lib\prisma.ts") {
    Write-Host "✅ lib\prisma.ts existe" -ForegroundColor Green
    $success += "lib\prisma.ts"
} else {
    Write-Host "⚠️  lib\prisma.ts no encontrado" -ForegroundColor Yellow
    $warnings += "lib\prisma.ts"
}

# Verificar lib/auth.ts
if (Test-Path "lib\auth.ts") {
    Write-Host "✅ lib\auth.ts existe" -ForegroundColor Green
    $success += "lib\auth.ts"
} else {
    Write-Host "⚠️  lib\auth.ts no encontrado" -ForegroundColor Yellow
    $warnings += "lib\auth.ts"
}

# Verificar lib/session.ts
if (Test-Path "lib\session.ts") {
    $sessionContent = Get-Content "lib\session.ts" -Raw
    
    if ($sessionContent -match "getSessionUserId") {
        Write-Host "✅ lib\session.ts: getSessionUserId encontrada" -ForegroundColor Green
        $success += "getSessionUserId"
    } else {
        Write-Host "⚠️  lib\session.ts: Falta función getSessionUserId" -ForegroundColor Yellow
        $warnings += "getSessionUserId"
    }
    
    if ($sessionContent -match "getSessionCompanyId") {
        Write-Host "✅ lib\session.ts: getSessionCompanyId encontrada" -ForegroundColor Green
        $success += "getSessionCompanyId"
    } else {
        Write-Host "⚠️  lib\session.ts: Falta función getSessionCompanyId" -ForegroundColor Yellow
        $warnings += "getSessionCompanyId"
    }
} else {
    Write-Host "⚠️  lib\session.ts no encontrado" -ForegroundColor Yellow
    $warnings += "lib\session.ts"
}

# Verificar lib/dates.ts
if (Test-Path "lib\dates.ts") {
    Write-Host "✅ lib\dates.ts existe" -ForegroundColor Green
    $success += "lib\dates.ts"
} else {
    Write-Host "⚠️  lib\dates.ts no encontrado (necesario para fromNow)" -ForegroundColor Yellow
    $warnings += "lib\dates.ts"
}

Write-Host ""
Write-Host "🎨 VERIFICANDO LAYOUT" -ForegroundColor Cyan
Write-Host "-" * 60 -ForegroundColor Gray

if (Test-Path "app\layout.tsx") {
    $layout = Get-Content "app\layout.tsx" -Raw
    
    if ($layout -match "Toaster") {
        Write-Host "✅ Layout: Toaster de sonner encontrado" -ForegroundColor Green
        $success += "Layout: Toaster"
    } else {
        Write-Host "⚠️  Layout: Falta agregar <Toaster /> de sonner" -ForegroundColor Yellow
        $warnings += "Layout: Toaster"
    }
} else {
    Write-Host "❌ app\layout.tsx no encontrado" -ForegroundColor Red
    $errors += "app\layout.tsx"
}

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host "📊 RESUMEN" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host ""

Write-Host "✅ Exitosos: $($success.Count)" -ForegroundColor Green
Write-Host "⚠️  Advertencias: $($warnings.Count)" -ForegroundColor Yellow
Write-Host "❌ Errores: $($errors.Count)" -ForegroundColor Red
Write-Host ""

if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "🎉 ¡TODO ESTÁ PERFECTO!" -ForegroundColor Green
    Write-Host "El sistema de assessments está completamente instalado." -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Próximos pasos:" -ForegroundColor Cyan
    Write-Host "1. Ejecuta: npm run dev" -ForegroundColor White
    Write-Host "2. Abre Prisma Studio: npx prisma studio" -ForegroundColor White
    Write-Host "3. Copia el ID de AssessmentTemplate" -ForegroundColor White
    Write-Host "4. Prueba: http://localhost:3000/assessments/[ID]" -ForegroundColor White
} elseif ($errors.Count -eq 0) {
    Write-Host "⚠️  Instalación casi completa" -ForegroundColor Yellow
    Write-Host "Hay algunas advertencias que deberías revisar." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📝 Advertencias pendientes:" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  • $warning" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Instalación incompleta" -ForegroundColor Red
    Write-Host "Hay errores que debes corregir antes de continuar." -ForegroundColor Red
    Write-Host ""
    Write-Host "📝 Errores encontrados:" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  • $error" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Gray
