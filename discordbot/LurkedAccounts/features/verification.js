const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
const { saveJson, addLogo } = require("../utils/fileManager");

// Lazy load security logs to avoid circular dependency
let securityLogs = null;
function getSecurityLogs() {
  if (!securityLogs) {
    securityLogs = require("./securityLogs");
  }
  return securityLogs;
}

// ============== CAPTCHA GENERATION ==============

function generateMathCaptcha() {
  const operations = ["+", "-", "×"];
  const operation = operations[Math.floor(Math.random() * operations.length)];

  let num1, num2, answer;

  switch (operation) {
    case "+":
      num1 = Math.floor(Math.random() * 20) + 1;
      num2 = Math.floor(Math.random() * 20) + 1;
      answer = num1 + num2;
      break;
    case "-":
      num1 = Math.floor(Math.random() * 20) + 10;
      num2 = Math.floor(Math.random() * num1);
      answer = num1 - num2;
      break;
    case "×":
      num1 = Math.floor(Math.random() * 10) + 1;
      num2 = Math.floor(Math.random() * 10) + 1;
      answer = num1 * num2;
      break;
  }

  const question = `${num1} ${operation} ${num2}`;

  // Generate wrong answers that are close to the correct answer
  const wrongAnswers = new Set();
  while (wrongAnswers.size < 3) {
    const offset = Math.floor(Math.random() * 10) - 5;
    const wrong = answer + (offset === 0 ? 1 : offset);
    if (wrong !== answer && wrong >= 0) {
      wrongAnswers.add(wrong);
    }
  }

  // Shuffle all answers
  const allAnswers = [answer, ...wrongAnswers];
  for (let i = allAnswers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allAnswers[i], allAnswers[j]] = [allAnswers[j], allAnswers[i]];
  }

  return {
    question,
    answer,
    options: allAnswers,
  };
}

// ============== VERIFICATION PANEL ==============

async function createVerificationPanel(interaction, config, configPath) {
  const channel = interaction.options.getChannel("channel") || interaction.channel;

  // Update config with verification channel
  if (!config.verification) {
    config.verification = {};
  }
  config.verification.channel_id = channel.id;
  saveJson(configPath, config);

  const embed = addLogo(
    new EmbedBuilder()
      .setTitle("Server Verification")
      .setDescription(
        "To gain access to this server, you must verify that you're human.\n\n" +
          "**How it works:**\n" +
          "• Click the button below to start\n" +
          "• Solve a simple math problem\n" +
          "• You have 3 attempts to answer correctly\n\n" +
          "Click **Verify** to begin!"
      )
      .setColor(0x5865F2)
      .setFooter({ text: "Verification System" })
      .setTimestamp(),
    config
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("verify_start")
      .setLabel("Verify")
      .setStyle(ButtonStyle.Success)
      .setEmoji("✅")
  );

  await channel.send({ embeds: [embed], components: [row] });

  return interaction.reply({
    content: `✅ Verification panel created in ${channel}!`,
    flags: 64,
  });
}

// ============== CAPTCHA VERIFICATION ==============

// Store active verification attempts
const verificationAttempts = new Map();

async function startVerification(interaction, config, data, dataPath) {
  const member = interaction.member;
  const verifiedRoleId = config.verification?.verified_role_id;

  // Check if already verified
  if (verifiedRoleId && member.roles.cache.has(verifiedRoleId)) {
    return interaction.reply({
      content: "✅ You are already verified!",
      flags: 64,
    });
  }

  // Check account age
  const minAge = config.verification?.min_account_age || 7;
  const accountAge = Date.now() - member.user.createdTimestamp;
  const minAgeMs = minAge * 24 * 60 * 60 * 1000;

  if (accountAge < minAgeMs) {
    const daysOld = Math.floor(accountAge / (24 * 60 * 60 * 1000));
    return interaction.reply({
      content: `❌ Your account must be at least **${minAge} days old** to verify. Your account is only **${daysOld} days old**.`,
      flags: 64,
    });
  }

  // Basic alt detection - check recent verifications from same IP pattern
  const recentVerifications = data.recent_verifications || [];
  const recentFromUser = recentVerifications.filter(
    (v) => v.user_id === member.id && Date.now() - v.timestamp < 300000
  );

  if (recentFromUser.length >= 3) {
    return interaction.reply({
      content: "❌ Too many verification attempts. Please wait a few minutes and try again.",
      flags: 64,
    });
  }

  // Generate CAPTCHA
  const captcha = generateMathCaptcha();

  // Store attempt
  verificationAttempts.set(member.id, {
    answer: captcha.answer,
    attempts: 0,
    maxAttempts: 3,
    timestamp: Date.now(),
  });

  // Create answer buttons
  const row = new ActionRowBuilder();
  captcha.options.forEach((option, index) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`verify_answer_${option}`)
        .setLabel(String(option))
        .setStyle(ButtonStyle.Secondary)
    );
  });

  const embed = new EmbedBuilder()
    .setTitle("🔢 Verification CAPTCHA")
    .setDescription(
      `Solve this math problem to verify:\n\n` +
        `**${captcha.question} = ?**\n\n` +
        `Click the button with the correct answer.\n` +
        `You have **3 attempts**.`
    )
    .setColor(0x5865F2)
    .setFooter({ text: "Attempts: 0/3" });

  return interaction.reply({
    embeds: [embed],
    components: [row],
    flags: 64,
  });
}

async function handleVerificationAnswer(interaction, config, data, dataPath) {
  const member = interaction.member;
  const answer = parseInt(interaction.customId.replace("verify_answer_", ""));
  const attempt = verificationAttempts.get(member.id);

  if (!attempt) {
    return interaction.reply({
      content: "❌ Your verification session has expired. Please click the Verify button again.",
      flags: 64,
    });
  }

  // Check if session expired (5 minutes)
  if (Date.now() - attempt.timestamp > 300000) {
    verificationAttempts.delete(member.id);
    return interaction.reply({
      content: "❌ Your verification session has expired. Please click the Verify button again.",
      flags: 64,
    });
  }

  attempt.attempts++;

  if (answer === attempt.answer) {
    // Correct answer - verify the user
    verificationAttempts.delete(member.id);

    const verifiedRoleId = config.verification?.verified_role_id;
    if (verifiedRoleId) {
      try {
        await member.roles.add(verifiedRoleId, "Verification: Passed CAPTCHA");
      } catch (error) {
        console.error("Failed to add verified role:", error);
        return interaction.update({
          content: "❌ Failed to add verified role. Please contact an administrator.",
          embeds: [],
          components: [],
        });
      }
    }

    // Track verification
    if (!data.verifications) data.verifications = {};
    data.verifications[member.id] = {
      verified_at: new Date().toISOString(),
      method: "captcha",
    };

    // Track recent verifications for alt detection
    if (!data.recent_verifications) data.recent_verifications = [];
    data.recent_verifications.push({
      user_id: member.id,
      timestamp: Date.now(),
    });

    // Clean old entries
    data.recent_verifications = data.recent_verifications.filter(
      (v) => Date.now() - v.timestamp < 3600000
    );

    saveJson(dataPath, data);

    // Log to security
    const secLogs = getSecurityLogs();
    secLogs.logVerification(member, "captcha", true, data, dataPath);

    const embed = new EmbedBuilder()
      .setTitle("✅ Verification Complete!")
      .setDescription("You have been verified and can now access the server.")
      .setColor(0x57F287)
      .setTimestamp();

    return interaction.update({
      embeds: [embed],
      components: [],
    });
  } else {
    // Wrong answer
    if (attempt.attempts >= attempt.maxAttempts) {
      // Out of attempts
      verificationAttempts.delete(member.id);

      // Log failed verification
      const secLogs = getSecurityLogs();
      secLogs.logVerification(member, "captcha", false, data, dataPath);

      const embed = new EmbedBuilder()
        .setTitle("❌ Verification Failed")
        .setDescription(
          "You've used all your attempts.\n\n" +
            "Please wait a moment and try again by clicking the Verify button."
        )
        .setColor(0xED4245);

      return interaction.update({
        embeds: [embed],
        components: [],
      });
    }

    // Generate new CAPTCHA for retry
    const newCaptcha = generateMathCaptcha();
    attempt.answer = newCaptcha.answer;
    attempt.timestamp = Date.now();

    const row = new ActionRowBuilder();
    newCaptcha.options.forEach((option) => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`verify_answer_${option}`)
          .setLabel(String(option))
          .setStyle(ButtonStyle.Secondary)
      );
    });

    const embed = new EmbedBuilder()
      .setTitle("❌ Incorrect Answer")
      .setDescription(
        `That was wrong. Try again!\n\n` +
          `**${newCaptcha.question} = ?**\n\n` +
          `Attempts remaining: **${attempt.maxAttempts - attempt.attempts}**`
      )
      .setColor(0xFEE75C)
      .setFooter({ text: `Attempts: ${attempt.attempts}/${attempt.maxAttempts}` });

    return interaction.update({
      embeds: [embed],
      components: [row],
    });
  }
}

// ============== MEMBER EVENTS ==============

async function handleMemberJoin(member, config, data, dataPath) {
  // Log join to security
  const secLogs = getSecurityLogs();
  secLogs.logMemberJoin(member, data, dataPath);

  // Send verification DM if configured
  if (config.verification?.dm_on_join) {
    const verifyChannel = config.verification?.channel_id;

    try {
      const embed = new EmbedBuilder()
        .setTitle(`Welcome to ${member.guild.name}!`)
        .setDescription(
          `Please verify yourself to access the server.\n\n` +
            (verifyChannel
              ? `Head to <#${verifyChannel}> and click the Verify button.`
              : "Find the verification channel and click the Verify button.")
        )
        .setColor(0x5865F2)
        .setTimestamp();

      await member.send({ embeds: [embed] });
    } catch (error) {
      // DMs likely disabled
    }
  }
}

async function handleMemberLeave(member, config, data, dataPath) {
  // Log leave to security
  const secLogs = getSecurityLogs();
  secLogs.logMemberLeave(member, data, dataPath);
}

// ============== ADMIN COMMANDS ==============

async function showVerificationStats(interaction, data, config) {
  const totalVerified = Object.keys(data.verifications || {}).length;
  const recentVerifications = (data.recent_verifications || []).filter(
    (v) => Date.now() - v.timestamp < 86400000
  ).length;

  const embed = addLogo(
    new EmbedBuilder()
      .setTitle("Verification Statistics")
      .addFields(
        { name: "Total Verified", value: `${totalVerified}`, inline: true },
        { name: "Last 24 Hours", value: `${recentVerifications}`, inline: true },
        {
          name: "Verified Role",
          value: config.verification?.verified_role_id
            ? `<@&${config.verification.verified_role_id}>`
            : "Not set",
          inline: true,
        },
        {
          name: "Min Account Age",
          value: `${config.verification?.min_account_age || 7} days`,
          inline: true,
        },
        {
          name: "Verification Channel",
          value: config.verification?.channel_id
            ? `<#${config.verification.channel_id}>`
            : "Not set",
          inline: true,
        }
      )
      .setColor(0x5865F2)
      .setTimestamp(),
    config
  );

  return interaction.reply({ embeds: [embed] });
}

async function configureVerification(interaction, config, configPath) {
  const setting = interaction.options.getString("setting");
  const value = interaction.options.getString("value");

  if (!config.verification) {
    config.verification = {};
  }

  let description = "";

  switch (setting) {
    case "role":
      const role = interaction.options.getRole("role_value");
      if (!role) {
        return interaction.reply({
          content: "❌ Please provide a role!",
          flags: 64,
        });
      }
      config.verification.verified_role_id = role.id;
      description = `Verified role set to ${role}`;
      break;

    case "min_age":
      const days = parseInt(value);
      if (isNaN(days) || days < 0 || days > 365) {
        return interaction.reply({
          content: "❌ Please provide a valid number of days (0-365)!",
          flags: 64,
        });
      }
      config.verification.min_account_age = days;
      description = `Minimum account age set to ${days} days`;
      break;

    case "dm_on_join":
      config.verification.dm_on_join = value.toLowerCase() !== "false";
      description = `DM on join ${config.verification.dm_on_join ? "enabled" : "disabled"}`;
      break;

    default:
      return interaction.reply({
        content: "❌ Unknown setting!",
        flags: 64,
      });
  }

  saveJson(configPath, config);

  const embed = new EmbedBuilder()
    .setDescription(`✅ ${description}`)
    .setColor(0x57F287);

  return interaction.reply({ embeds: [embed] });
}

async function setVerificationChannel(interaction, config, configPath) {
  const channel = interaction.options.getChannel("channel", true);

  if (!config.verification) {
    config.verification = {};
  }
  config.verification.channel_id = channel.id;
  saveJson(configPath, config);

  const embed = new EmbedBuilder()
    .setDescription(`✅ Verification channel set to ${channel}`)
    .setColor(0x57F287);

  return interaction.reply({ embeds: [embed] });
}

async function manualVerify(interaction, member, config, data, dataPath) {
  const verifiedRoleId = config.verification?.verified_role_id;

  if (!verifiedRoleId) {
    return interaction.reply({
      content: "❌ No verified role configured! Use `/verify config role` to set one.",
      flags: 64,
    });
  }

  if (member.roles.cache.has(verifiedRoleId)) {
    return interaction.reply({
      content: `❌ ${member} is already verified!`,
      flags: 64,
    });
  }

  try {
    await member.roles.add(verifiedRoleId, `Manual verification by ${interaction.user.tag}`);
  } catch (error) {
    return interaction.reply({
      content: "❌ Failed to add verified role. Check bot permissions.",
      flags: 64,
    });
  }

  // Track verification
  if (!data.verifications) data.verifications = {};
  data.verifications[member.id] = {
    verified_at: new Date().toISOString(),
    method: "manual",
    verified_by: interaction.user.id,
  };
  saveJson(dataPath, data);

  // Log to security
  const secLogs = getSecurityLogs();
  secLogs.logVerification(member, "manual", true, data, dataPath);

  const embed = addLogo(
    new EmbedBuilder()
      .setDescription(`✅ Successfully verified ${member}`)
      .setColor(0x57F287),
    config
  );

  return interaction.reply({ embeds: [embed] });
}

async function unverifyUser(interaction, member, config, data, dataPath) {
  const verifiedRoleId = config.verification?.verified_role_id;

  if (!verifiedRoleId) {
    return interaction.reply({
      content: "❌ No verified role configured!",
      flags: 64,
    });
  }

  if (!member.roles.cache.has(verifiedRoleId)) {
    return interaction.reply({
      content: `❌ ${member} is not verified!`,
      flags: 64,
    });
  }

  try {
    await member.roles.remove(verifiedRoleId, `Unverified by ${interaction.user.tag}`);
  } catch (error) {
    return interaction.reply({
      content: "❌ Failed to remove verified role. Check bot permissions.",
      flags: 64,
    });
  }

  // Remove from verifications
  if (data.verifications?.[member.id]) {
    delete data.verifications[member.id];
    saveJson(dataPath, data);
  }

  const embed = addLogo(
    new EmbedBuilder()
      .setDescription(`✅ Removed verification from ${member}`)
      .setColor(0x57F287),
    config
  );

  return interaction.reply({ embeds: [embed] });
}

module.exports = {
  createVerificationPanel,
  startVerification,
  handleVerificationAnswer,
  handleMemberJoin,
  handleMemberLeave,
  showVerificationStats,
  configureVerification,
  setVerificationChannel,
  manualVerify,
  unverifyUser,
};
