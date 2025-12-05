// Script para debuggear problemas con ruleta
console.log('🔍 DEBUGGEANDO RULETA...\n');

// Verificar que el archivo existe
try {
  const fs = require('fs');
  const path = require('path');

  const interactionFile = path.join(__dirname, 'src/events/interactionCreate.js');
  if (fs.existsSync(interactionFile)) {
    console.log('✅ Archivo interactionCreate.js existe');
    const stats = fs.statSync(interactionFile);
    console.log(`📊 Tamaño: ${stats.size} bytes`);
    console.log(`📅 Última modificación: ${stats.mtime}`);
  } else {
    console.log('❌ Archivo interactionCreate.js NO existe');
  }

  // Verificar imports
  const interactionContent = fs.readFileSync(interactionFile, 'utf8');
  const hasRlImport = interactionContent.includes('require("../systems/roulette/simple")');
  console.log(`🔗 Import de ruleta: ${hasRlImport ? '✅' : '❌'}`);

  // Verificar handlers
  const handlers = [
    'customId === "rl_play"',
    'customId?.startsWith("rl_type_")',
    'customId?.startsWith("rl_amt_")',
    'customId.startsWith("rl_exit_select_")',
    'customId.startsWith("rl_again_")'
  ];

  console.log('\n🎯 HANDLERS DE RULETA:');
  handlers.forEach(handler => {
    const exists = interactionContent.includes(handler);
    console.log(`  ${handler}: ${exists ? '✅' : '❌'}`);
  });

  // Verificar sistema de ruleta
  const rlFile = path.join(__dirname, 'src/systems/roulette/simple.js');
  if (fs.existsSync(rlFile)) {
    console.log('\n✅ Sistema de ruleta existe');

    const rlContent = fs.readFileSync(rlFile, 'utf8');
    const functions = ['function create', 'function get', 'function setBet', 'function spin', 'function del'];
    console.log('🔧 FUNCIONES DE RULETA:');
    functions.forEach(func => {
      const exists = rlContent.includes(func);
      console.log(`  ${func}: ${exists ? '✅' : '❌'}`);
    });
  } else {
    console.log('\n❌ Sistema de ruleta NO existe');
  }

} catch (error) {
  console.log('❌ Error durante el debugging:', error.message);
}

console.log('\n📋 INSTRUCCIONES:');
console.log('1. Ejecuta este script: node debug_ruleta.js');
console.log('2. Revisa los logs de la consola cuando interactúes con botones de ruleta');
console.log('3. Comparte los logs si hay errores');


