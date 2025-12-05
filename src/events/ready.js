const { saveAllDatabases } = require("../database");
const config = require("../utils/config");
const memberships = require("../database/memberships");
const {
  isExpired,
  calculateCashback,
  getUserMembership,
} = require("../utils/memberships");
const economy = require("../database/economy");

module.exports = {
  name: "clientReady",
  once: true,

  async execute(client) {
    console.log(`[Bot] Logged in as ${client.user.tag}`);
    console.log(`[Bot] Serving ${client.guilds.cache.size} servers`);

    client.user.setActivity("Emerald Isle Casino ®", { type: 3 });

    // Auto-guardado
    setInterval(() => {
      saveAllDatabases();
    }, config.AUTOSAVE_INTERVAL);
    console.log(
      `[Autoping] Auto-save configured every ${config.AUTOSAVE_INTERVAL / 1000} seconds`,
    );

    // ============================================================
    // SISTEMA DE EXPIRACIÓN AUTOMÁTICA DE MEMBRESÍAS
    // ============================================================
    setInterval(async () => {
      try {
        const expiredMemberships = memberships.getExpiredMemberships();

        for (const membership of expiredMemberships) {
          if (isExpired(membership)) {
            memberships.expireMembership(membership.user_id);

            // Notificación al usuario
            try {
              const user = await client.users.fetch(membership.user_id);
              const membershipType =
                membership.membership_type.charAt(0).toUpperCase() +
                membership.membership_type.slice(1);

              await user.send({
                embeds: [
                  {
                    title: `⏰ ${config.CASINO_NAME} - Membresía Expirada`,
                    description:
                      `Tu membresía **${membershipType}** ha expirado.\n\n` +
                      `💎 Puedes renovar comprando una nueva cuando gustes.\n\n` +
                      `¡Gracias por ser parte de ${config.CASINO_NAME}!`,
                    color: 0xff6b6b,
                    footer: { text: "Emerald Isle Casino ®" },
                    timestamp: new Date().toISOString(),
                  },
                ],
              });
            } catch (err) {
              console.error(
                `[Memberships] Error notifying user ${membership.user_id}:`,
                err,
              );
            }
          }
        }

        if (expiredMemberships.length > 0) {
          console.log(
            `[Memberships] Processed ${expiredMemberships.length} expired membership(s)`,
          );
        }
      } catch (err) {
        console.error("[Memberships] Error in membership renewal check:", err);
      }
    }, 60000);

    console.log(
      "[Memberships] Auto-renewal system initialized (checking every 60 seconds)",
    );

    // ============================================================
    // SISTEMA DE CASHBACK SEMANAL
    // ============================================================

    const checkCashback = async () => {
      try {
        const now = new Date();
        const dayOfWeek = now.getDay();

        // Ejecutar solo lunes 00:00
        if (dayOfWeek !== 1 || now.getHours() !== 0 || now.getMinutes() >= 1)
          return;

        const weekStart = memberships.getWeekStart();
        const weeklyLosses = memberships.getAllWeeklyLosses(weekStart);

        let totalCashback = 0;
        let usersProcessed = 0;

        for (const lossRecord of weeklyLosses) {
          const membership = getUserMembership(lossRecord.user_id);

          if (!membership) continue;
          if (lossRecord.total_loss <= 0) continue;
          if (lossRecord.cashback_applied !== 0) continue;

          const cashbackAmount = calculateCashback(
            lossRecord.user_id,
            lossRecord.total_loss,
          );

          if (cashbackAmount <= 0) continue;

          economy.addBalance(
            lossRecord.user_id,
            cashbackAmount,
            "system",
            "Cashback semanal por membresía",
          );

          memberships.markCashbackApplied(
            lossRecord.user_id,
            weekStart,
            cashbackAmount,
          );

          // Notificar al usuario
          try {
            const user = await client.users.fetch(lossRecord.user_id);
            const type =
              membership.membership_type.charAt(0).toUpperCase() +
              membership.membership_type.slice(1);
            const rate =
              membership.membership_type === "silver"
                ? "5%"
                : membership.membership_type === "gold"
                  ? "10%"
                  : "15%";

            await user.send({
              embeds: [
                {
                  title: `💰 ${config.CASINO_NAME} - Cashback Semanal`,
                  description:
                    `¡Tu cashback semanal ha sido aplicado!\n\n` +
                    `💎 **Membresía:** ${type}\n` +
                    `📊 **Pérdidas:** ${config.CURRENCY_SYMBOL} ${lossRecord.total_loss.toLocaleString()}\n` +
                    `🎁 **Cashback (${rate}):** ${config.CURRENCY_SYMBOL} ${cashbackAmount.toLocaleString()}\n\n` +
                    `¡Gracias por ser miembro de ${config.CASINO_NAME}!`,
                  color: 0xffd700,
                  footer: { text: "Emerald Isle Casino ®" },
                  timestamp: new Date().toISOString(),
                },
              ],
            });
          } catch (err) {
            console.error(
              `[Cashback] Error notifying user ${lossRecord.user_id}:`,
              err,
            );
          }

          totalCashback += cashbackAmount;
          usersProcessed++;
        }

        memberships.resetWeeklyLosses(weekStart);

        if (usersProcessed > 0) {
          console.log(
            `[Cashback] Weekly cashback applied to ${usersProcessed} user(s). Total: ${config.CURRENCY_SYMBOL} ${totalCashback.toLocaleString()}`,
          );
        }
      } catch (err) {
        console.error("[Cashback] Error in weekly cashback check:", err);
      }
    };

    // Ejecutar al iniciar
    checkCashback();

    // Revisar cada hora si toca cashback semanal
    setInterval(checkCashback, 3600000);

    console.log(
      "[Cashback] Weekly cashback system initialized (checking hourly)",
    );

    // SISTEMA DE MANTENIMIENTO SEMANAL
    const runWeeklyMaintenance = async () => {
      try {
        console.log("[Maintenance] Running weekly maintenance...");

        const { cleanupOldLogs } = require("../database/logs");
        const { resetBrokenStreaks } = require("../database/dailyRewards");

        // Limpiar logs antiguos (30 días)
        const logsCleaned = cleanupOldLogs(30);
        console.log(`[Maintenance] Cleaned up ${logsCleaned} old log entries`);

        // Resetear rachas rotas de recompensas diarias
        const streaksReset = resetBrokenStreaks();
        console.log(`[Maintenance] Reset ${streaksReset} broken daily reward streaks`);

        console.log("[Maintenance] Weekly maintenance completed");
      } catch (error) {
        console.error("[Maintenance] Error in weekly maintenance:", error);
      }
    };

    // SISTEMA DE CIERRE AUTOMÁTICO DE TORNEOS
    const checkExpiredTournaments = async () => {
      try {
        const { getAllTournaments, updateTournamentStatus, distributeTournamentPrize, getTournamentParticipants } = require("../database/tournaments");

        const activeTournaments = getAllTournaments('active');
        const now = new Date();

        for (const tournament of activeTournaments) {
          const endTime = new Date(tournament.end_time);

          if (now >= endTime) {
            console.log(`[Tournaments] Closing expired tournament ${tournament.id}: ${tournament.name}`);

            // Determinar ganador basado en puntos
            const participants = getTournamentParticipants(tournament.id);
            if (participants.length > 0) {
              // Ordenar por puntos descendente
              const sortedParticipants = participants.sort((a, b) => b.score - a.score);
              const winner = sortedParticipants[0];

              // Cerrar torneo con ganador
              updateTournamentStatus(tournament.id, 'completed', winner.user_id);
              distributeTournamentPrize(tournament.id);

              console.log(`[Tournaments] Tournament ${tournament.id} completed. Winner: ${winner.user_id} with ${winner.score} points`);
            } else {
              // Cerrar torneo sin participantes
              updateTournamentStatus(tournament.id, 'completed');
              console.log(`[Tournaments] Tournament ${tournament.id} completed with no participants`);
            }
          }
        }
      } catch (error) {
        console.error("[Tournaments] Error checking expired tournaments:", error);
      }
    };

    // Ejecutar mantenimiento semanal (cada 7 días)
    setInterval(runWeeklyMaintenance, 7 * 24 * 60 * 60 * 1000);

    // Ejecutar mantenimiento inicial después de 1 hora
    setTimeout(runWeeklyMaintenance, 60 * 60 * 1000);

    // Verificar torneos expirados cada hora
    setInterval(checkExpiredTournaments, 60 * 60 * 1000);

    // Ejecutar verificación inicial de torneos después de 5 minutos
    setTimeout(checkExpiredTournaments, 5 * 60 * 1000);

    console.log("[Maintenance] Weekly maintenance system initialized");
    console.log("[Tournaments] Tournament expiration checker initialized");
  },
};
