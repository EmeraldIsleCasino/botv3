const { MEMBERSHIP_ROLES } = require('./config');
const { getUserMembership, MEMBERSHIP_TYPES } = require('./memberships');

async function assignMembershipRole(guild, userId, membershipType) {
  try {
    const member = await guild.members.fetch(userId);
    if (!member) return false;

    const roleId = MEMBERSHIP_ROLES[membershipType.toLowerCase()];
    if (!roleId || roleId === `ROLE_ID_${membershipType.toUpperCase()}`) {
      console.warn(`[DiscordRoles] Role ID not configured for ${membershipType}`);
      return false;
    }

    const role = guild.roles.cache.get(roleId);
    if (!role) {
      console.warn(`[DiscordRoles] Role ${roleId} not found in guild ${guild.id}`);
      return false;
    }

    // Remover roles de membresía anteriores
    await removeAllMembershipRoles(guild, userId);

    // Asignar el nuevo rol
    await member.roles.add(role);
    console.log(`[DiscordRoles] Assigned ${membershipType} role to ${member.user.tag}`);
    return true;
  } catch (error) {
    console.error(`[DiscordRoles] Error assigning ${membershipType} role to ${userId}:`, error);
    return false;
  }
}

async function removeMembershipRole(guild, userId, membershipType) {
  try {
    const member = await guild.members.fetch(userId);
    if (!member) return false;

    const roleId = MEMBERSHIP_ROLES[membershipType.toLowerCase()];
    if (!roleId || roleId === `ROLE_ID_${membershipType.toUpperCase()}`) {
      return false;
    }

    const role = guild.roles.cache.get(roleId);
    if (!role) return false;

    await member.roles.remove(role);
    console.log(`[DiscordRoles] Removed ${membershipType} role from ${member.user.tag}`);
    return true;
  } catch (error) {
    console.error(`[DiscordRoles] Error removing ${membershipType} role from ${userId}:`, error);
    return false;
  }
}

async function removeAllMembershipRoles(guild, userId) {
  try {
    const member = await guild.members.fetch(userId);
    if (!member) return false;

    const rolesToRemove = [];

    for (const [type, roleId] of Object.entries(MEMBERSHIP_ROLES)) {
      if (roleId && roleId !== `ROLE_ID_${type.toUpperCase()}`) {
        const role = guild.roles.cache.get(roleId);
        if (role && member.roles.cache.has(roleId)) {
          rolesToRemove.push(role);
        }
      }
    }

    if (rolesToRemove.length > 0) {
      await member.roles.remove(rolesToRemove);
      console.log(`[DiscordRoles] Removed ${rolesToRemove.length} membership roles from ${member.user.tag}`);
    }

    return true;
  } catch (error) {
    console.error(`[DiscordRoles] Error removing all membership roles from ${userId}:`, error);
    return false;
  }
}

async function syncMembershipRoles(guild) {
  try {
    console.log(`[DiscordRoles] Starting membership role sync for guild ${guild.id}`);

    const membershipsDb = require('../database/memberships');
    const activeMemberships = membershipsDb.getAllActiveMemberships();

    let synced = 0;
    let errors = 0;

    console.log(`[DiscordRoles] Processing ${activeMemberships.length} active memberships...`);

    // Procesar membresías activas (esta parte es segura)
    for (const membership of activeMemberships) {
      try {
        const success = await assignMembershipRole(guild, membership.user_id, membership.membership_type);
        if (success) synced++;
        else errors++;
      } catch (error) {
        console.error(`[DiscordRoles] Error syncing membership for user ${membership.user_id}:`, error);
        errors++;
      }
    }

    console.log(`[DiscordRoles] Successfully synced ${synced} active memberships`);

    // Intentar remover roles de usuarios inactivos (puede fallar en servidores grandes)
    try {
      console.log(`[DiscordRoles] Attempting to remove roles from inactive users...`);
      const allMembers = await guild.members.fetch({ timeout: 30000 }); // 30 segundos timeout
      let rolesRemoved = 0;

      for (const [memberId, member] of allMembers) {
        const membership = getUserMembership(memberId);
        if (!membership) {
          // Usuario no tiene membresía, remover todos los roles de membresía
          const success = await removeAllMembershipRoles(guild, memberId);
          if (success) rolesRemoved++;
        }
      }

      console.log(`[DiscordRoles] Removed membership roles from ${rolesRemoved} inactive users`);
    } catch (error) {
      if (error.code === 'GuildMembersTimeout') {
        console.warn(`[DiscordRoles] ⚠️  Guild members fetch timed out for guild ${guild.id}.`);
        console.warn(`[DiscordRoles] 📝 This is NORMAL for large servers (>1000 members).`);
        console.warn(`[DiscordRoles] 💡 Active memberships were synced successfully (${synced} users).`);
        console.warn(`[DiscordRoles] 🛠️  You can manually remove old membership roles using Discord's role management if needed.`);
      } else {
        console.error(`[DiscordRoles] Error fetching guild members:`, error);
        errors++;
      }
    }

    console.log(`[DiscordRoles] ✅ Sync completed: ${synced} synced, ${errors} errors`);
    return { synced, errors };
  } catch (error) {
    console.error(`[DiscordRoles] Fatal error during membership role sync:`, error);
    return { synced: 0, errors: 1 };
  }
}

function getMembershipRoleId(membershipType) {
  return MEMBERSHIP_ROLES[membershipType.toLowerCase()];
}

function getRoleEmoji(membershipType) {
  const membership = MEMBERSHIP_TYPES[membershipType.toLowerCase()];
  return membership ? membership.emoji : '❓';
}

function getRoleColor(membershipType) {
  const membership = MEMBERSHIP_TYPES[membershipType.toLowerCase()];
  return membership ? membership.color : 0x95a5a6;
}

module.exports = {
  assignMembershipRole,
  removeMembershipRole,
  removeAllMembershipRoles,
  syncMembershipRoles,
  getMembershipRoleId,
  getRoleEmoji,
  getRoleColor
};
