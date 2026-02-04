/**
 * Configuration Validation Utilities
 * Validates bot configuration before saving to prevent corruption
 */

// Validate Discord snowflake ID (17-19 digits)
const validateDiscordId = (id) => {
  if (!id) return true; // Allow empty/null
  return /^\d{17,19}$/.test(String(id));
};

// Validate hex color (#RRGGBB)
const validateHexColor = (color) => {
  if (!color) return true; // Allow empty/null
  return /^#[0-9A-F]{6}$/i.test(String(color));
};

// Validate array of Discord IDs
const validateDiscordIdArray = (arr) => {
  if (!arr) return true; // Allow empty/null
  if (!Array.isArray(arr)) return false;
  return arr.every(id => validateDiscordId(id));
};

// Validate number within range
const validateNumberInRange = (value, min, max) => {
  const num = Number(value);
  if (isNaN(num)) return false;
  return num >= min && num <= max;
};

// Validation schemas for config sections
const schemas = {
  general: {
    fields: {
      client_id: { type: 'string', validate: validateDiscordId },
      guild_ids: { type: 'array', validate: validateDiscordIdArray },
      owner_user_ids: { type: 'array', validate: validateDiscordIdArray },
      owner_role_ids: { type: 'array', validate: validateDiscordIdArray },
      coowner_role_ids: { type: 'array', validate: validateDiscordIdArray },
      staff_role_ids: { type: 'array', validate: validateDiscordIdArray },
      drops_channel_id: { type: 'string', validate: validateDiscordId },
      ticket_category_id: { type: 'string', validate: validateDiscordId },
      ticket_log_channel_id: { type: 'string', validate: validateDiscordId },
      welcome_channel_id: { type: 'string', validate: validateDiscordId },
      leave_channel_id: { type: 'string', validate: validateDiscordId },
      audit_log_channel_id: { type: 'string', validate: validateDiscordId },
      verification_channel_id: { type: 'string', validate: validateDiscordId },
      ticket_ratings_channel_id: { type: 'string', validate: validateDiscordId },
      verify_log_channel_id: { type: 'string', validate: validateDiscordId },
      logo_url: { type: 'string' }
    }
  },

  automod: {
    fields: {
      enabled: { type: 'boolean' },
      spam: {
        type: 'object',
        fields: {
          enabled: { type: 'boolean' },
          message_limit: { type: 'number', validate: (v) => validateNumberInRange(v, 2, 50) },
          time_window: { type: 'number', validate: (v) => validateNumberInRange(v, 1000, 60000) },
          action: { type: 'string', enum: ['delete', 'timeout', 'kick', 'ban'] },
          timeout_duration: { type: 'number' },
          ignore_roles: { type: 'array', validate: validateDiscordIdArray }
        }
      },
      caps: {
        type: 'object',
        fields: {
          enabled: { type: 'boolean' },
          percentage: { type: 'number', validate: (v) => validateNumberInRange(v, 50, 100) },
          min_length: { type: 'number', validate: (v) => validateNumberInRange(v, 3, 100) },
          action: { type: 'string', enum: ['delete', 'timeout', 'kick', 'ban'] },
          timeout_duration: { type: 'number' },
          ignore_roles: { type: 'array', validate: validateDiscordIdArray }
        }
      },
      links: {
        type: 'object',
        fields: {
          enabled: { type: 'boolean' },
          block_invites: { type: 'boolean' },
          whitelist: { type: 'array' },
          action: { type: 'string', enum: ['delete', 'timeout', 'kick', 'ban'] },
          timeout_duration: { type: 'number' },
          ignore_roles: { type: 'array', validate: validateDiscordIdArray }
        }
      },
      badwords: {
        type: 'object',
        fields: {
          enabled: { type: 'boolean' },
          words: { type: 'array' },
          use_strike_system: { type: 'boolean' },
          action: { type: 'string', enum: ['delete', 'timeout', 'kick', 'ban'] },
          timeout_duration: { type: 'number' },
          ignore_roles: { type: 'array', validate: validateDiscordIdArray }
        }
      },
      strikes: {
        type: 'object',
        fields: {
          strike_1_action: { type: 'string', enum: ['delete', 'timeout', 'kick', 'ban'] },
          strike_1_duration: { type: 'number' },
          strike_2_action: { type: 'string', enum: ['delete', 'timeout', 'kick', 'ban'] },
          strike_2_duration: { type: 'number' },
          strike_3_action: { type: 'string', enum: ['delete', 'timeout', 'kick', 'ban'] }
        }
      },
      immune_roles: { type: 'array', validate: validateDiscordIdArray }
    }
  },

  verification: {
    fields: {
      enabled: { type: 'boolean' },
      verified_role_id: { type: 'string', validate: validateDiscordId },
      min_account_age_days: { type: 'number', validate: (v) => validateNumberInRange(v, 0, 365) },
      alt_detection_enabled: { type: 'boolean' },
      kick_on_fail: { type: 'boolean' },
      backup_on_leave: { type: 'boolean' },
      send_dm_on_join: { type: 'boolean' },
      use_oauth: { type: 'boolean' },
      ip_alt_detection: { type: 'boolean' },
      kick_on_deny: { type: 'boolean' },
      panel_title: { type: 'string' },
      panel_description: { type: 'string' },
      panel_color: { type: 'string', validate: validateHexColor }
    }
  },

  ticket_panel: {
    fields: {
      title: { type: 'string' },
      description: { type: 'string' },
      color: { type: 'string', validate: validateHexColor },
      footer: { type: 'string' },
      thumbnail: { type: 'string' },
      image: { type: 'string' },
      buttons: {
        type: 'array',
        validate: (arr) => {
          if (!Array.isArray(arr)) return false;
          if (arr.length > 25) return false; // Discord limit
          return arr.every(btn =>
            btn.id && btn.label &&
            ['Primary', 'Secondary', 'Success', 'Danger'].includes(btn.style)
          );
        }
      }
    }
  },

  roles_panel: {
    fields: {
      title: { type: 'string' },
      description: { type: 'string' },
      color: { type: 'string', validate: validateHexColor },
      footer: { type: 'string' },
      thumbnail: { type: 'string' },
      image: { type: 'string' },
      roles: {
        type: 'array',
        validate: (arr) => {
          if (!Array.isArray(arr)) return false;
          if (arr.length > 25) return false; // Discord limit
          return arr.every(role =>
            role.id && role.label && role.role_id &&
            validateDiscordId(role.role_id) &&
            ['Primary', 'Secondary', 'Success', 'Danger'].includes(role.style)
          );
        }
      }
    }
  }
};

/**
 * Validate a config section against its schema
 * @param {string} section - The config section name
 * @param {object} data - The data to validate
 * @returns {object} { valid: boolean, errors: string[] }
 */
function validateConfig(section, data) {
  const errors = [];

  // Check if schema exists for this section
  const schema = schemas[section];
  if (!schema) {
    // No schema defined - allow all (backward compatibility)
    return { valid: true, errors: [] };
  }

  // Validate each field
  const validateFields = (fields, dataObj, prefix = '') => {
    for (const [fieldName, fieldSchema] of Object.entries(fields)) {
      const fullFieldName = prefix ? `${prefix}.${fieldName}` : fieldName;
      const value = dataObj[fieldName];

      // Skip if field not present and not required
      if (value === undefined || value === null) {
        if (fieldSchema.required) {
          errors.push(`${fullFieldName} is required`);
        }
        continue;
      }

      // Type validation
      if (fieldSchema.type === 'string' && typeof value !== 'string') {
        errors.push(`${fullFieldName} must be a string`);
        continue;
      }
      if (fieldSchema.type === 'number' && typeof value !== 'number') {
        errors.push(`${fullFieldName} must be a number`);
        continue;
      }
      if (fieldSchema.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`${fullFieldName} must be a boolean`);
        continue;
      }
      if (fieldSchema.type === 'array' && !Array.isArray(value)) {
        errors.push(`${fullFieldName} must be an array`);
        continue;
      }

      // Enum validation
      if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
        errors.push(`${fullFieldName} must be one of: ${fieldSchema.enum.join(', ')}`);
        continue;
      }

      // Custom validation function
      if (fieldSchema.validate && !fieldSchema.validate(value)) {
        errors.push(`${fullFieldName} has invalid value`);
        continue;
      }

      // Nested object validation
      if (fieldSchema.type === 'object' && fieldSchema.fields) {
        validateFields(fieldSchema.fields, value, fullFieldName);
      }
    }
  };

  validateFields(schema.fields, data);

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

module.exports = {
  validateConfig,
  validateDiscordId,
  validateHexColor,
  validateDiscordIdArray,
  validateNumberInRange
};
