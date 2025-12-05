# Configuración de Roles de Membresías - Emerald Isle Casino ®

## 📋 PASOS PARA CONFIGURAR ROLES DE MEMBRESÍAS

### 1. Crear Roles en Discord

Ve a **Configuración del Servidor** → **Roles** y crea los siguientes roles:

#### 🥈 **Rol Silver**
- **Nombre:** `🥈 Silver Member`
- **Color:** `#C0C0C0` (Plata)
- **Permisos:** Sin permisos especiales (solo visual)
- **Posición:** Debajo de miembros normales

#### 🥇 **Rol Gold**
- **Nombre:** `🥇 Gold Member`
- **Color:** `#FFD700` (Oro)
- **Permisos:** Sin permisos especiales (solo visual)
- **Posición:** Encima del rol Silver

#### 💎 **Rol Platinum**
- **Nombre:** `💎 Platinum Member`
- **Color:** `#E5E4E2` (Plata con tinte)
- **Permisos:** Sin permisos especiales (solo visual)
- **Posición:** Encima del rol Gold

### 2. Obtener IDs de Roles

1. Activa el **Modo Desarrollador** en Discord (Configuración de Usuario → Avanzado → Modo Desarrollador)
2. Haz clic derecho en cada rol y selecciona **"Copiar ID"**
3. Anota los IDs de cada rol

### 3. Configurar en el Bot

Edita el archivo `src/utils/config.js` y reemplaza los valores placeholders:

```javascript
MEMBERSHIP_ROLES: {
  silver: '1445980619837542471',      // ← Pega aquí el ID real del rol Silver
  gold: '1445981472686211153',          // ← Pega aquí el ID real del rol Gold
  platinum: '1445981632682131536'   // ← Pega aquí el ID real del rol Platinum
}
```

**Ejemplo:**
```javascript
MEMBERSHIP_ROLES: {
  silver: '123456789012345678',
  gold: '123456789012345679',
  platinum: '123456789012345680'
}
```

### 4. Reiniciar el Bot

Después de configurar los roles:
1. Sube el archivo `src/utils/config.js` a Replit
2. Reinicia el bot

### 5. Probar el Sistema

1. **Compra una membresía:** Usa `/membresias publicar` y compra una membresía
2. **Verifica el rol:** El usuario debería recibir automáticamente el rol correspondiente
3. **Sincronización:** Si hay usuarios existentes, usa `/sincronizarroles` como admin

## 🔧 FUNCIONALIDADES AUTOMÁTICAS

### ✅ **Asignación Automática**
- Los roles se asignan automáticamente al comprar membresías
- Se remueven automáticamente al expirar o cancelar membresías
- Solo se permite un rol de membresía a la vez

### ✅ **Comandos Disponibles**
- `/mimembresia` - Ver estado de membresía (todos)
- `/sincronizarroles` - Sincronizar roles manualmente (admins)

### ✅ **Sistema de Beneficios**
Los miembros con roles reciben automáticamente:
- Bonos de depósito (10%/20%/30%)
- Límites de apuesta más altos ($7.5k/$10k/$15k)
- Cashback semanal automático
- Bono en ganancias de juegos

## ⚠️ NOTAS IMPORTANTES

- **Permisos del Bot:** Asegúrate de que el bot tenga permisos para **Gestionar Roles**
- **Jerarquía:** El rol del bot debe estar POR ENCIMA de los roles de membresía
- **IDs Correctos:** Verifica que los IDs de roles sean correctos
- **Un Rol por Usuario:** El sistema automáticamente remueve roles anteriores

## 🆘 SOLUCIÓN DE PROBLEMAS

### "Rol no encontrado"
- Verifica que los IDs en `config.js` sean correctos
- Asegúrate de que los roles existan en el servidor

### "Bot no puede asignar roles"
- Revisa la jerarquía de roles del bot
- Otorga permisos de "Gestionar Roles"

### "Roles no se sincronizan"
- Usa `/sincronizarroles` como administrador
- Revisa los logs del bot en Replit

### "GuildMembersTimeout" (Error común en servidores grandes)
- **Esto es NORMAL** en servidores con >1000 miembros
- El bot puede sincronizar roles activos pero no remover roles inactivos
- Los roles se siguen asignando automáticamente en compras/renovaciones
- Puedes remover roles antiguos manualmente desde Discord

## 🎯 RESULTADO FINAL

Una vez configurado, tendrás un sistema completo de membresías premium con:
- ✅ Roles visuales en Discord
- ✅ Beneficios automáticos en juegos
- ✅ Gestión automática de roles
- ✅ Sincronización manual disponible

¡Los miembros premium ahora tendrán una experiencia VIP completa! 🎰✨
