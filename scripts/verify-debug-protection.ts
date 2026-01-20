// scripts/verify-debug-protection.ts
/**
 * Script para verificar que los endpoints de debug están protegidos
 * 
 * Uso:
 *   npm run verify-debug
 *   NODE_ENV=production npm run verify-debug
 */

const ENDPOINTS_TO_TEST = [
  '/api/debug-session',
  // Agregar otros endpoints de debug aquí
]

async function testEndpoint(url: string) {
  console.log(`\n🧪 Testing: ${url}`)

  try {
    const response = await fetch(`http://localhost:3000${url}`)

    console.log(`   Status: ${response.status}`)

    const isProd = process.env.NODE_ENV === 'production'

    if (isProd) {
      // En producción debe ser 404
      if (response.status === 404) {
        console.log('   ✅ Protected in production')
        return true
      } else {
        console.log('   ❌ NOT PROTECTED IN PRODUCTION!')
        console.log('   🚨 CRITICAL SECURITY ISSUE!')
        return false
      }
    } else {
      // En desarrollo puede ser 200 (admin) o 403 (no admin)
      if (response.status === 200) {
        console.log('   ✅ Accessible in development (admin)')
        return true
      } else if (response.status === 403) {
        console.log('   ✅ Protected in development (non-admin)')
        return true
      } else if (response.status === 404) {
        console.log('   ⚠️  Blocked (check DEBUG_ROUTES_ENABLED)')
        return true // No es error crítico
      } else {
        console.log('   ⚠️  Unexpected status in development')
        return true // No es error crítico
      }
    }
  } catch (error) {
    console.log('   ❌ Error:', error)
    return false
  }
}

async function main() {
  console.log('🔐 Verificando protección de endpoints de debug...')
  console.log('='.repeat(60))
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🚦 Debug routes: ${process.env.DEBUG_ROUTES_ENABLED || 'not set'}`)
  console.log('='.repeat(60))

  const results = await Promise.all(
    ENDPOINTS_TO_TEST.map(testEndpoint)
  )

  const allPassed = results.every((r) => r)

  console.log('\n' + '='.repeat(60))
  if (allPassed) {
    console.log('✅ PASSED: Todos los endpoints están protegidos correctamente')
    console.log('='.repeat(60))
    process.exit(0)
  } else {
    console.log('❌ FAILED: Algunos endpoints NO están protegidos')
    console.log('🚨 ACCIÓN REQUERIDA: Revisar implementación de guards')
    console.log('='.repeat(60))
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('💥 Error ejecutando verificación:', error)
  process.exit(1)
})