const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const VIDEO_EXTENSIONS = new Set(["mp4"]);

const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_VIDEO_BYTES = 10 * 1024 * 1024;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function getMaxImageBytes() {
  return parsePositiveInt(process.env.VOUCH_MAX_IMAGE_BYTES, DEFAULT_MAX_IMAGE_BYTES);
}

function getMaxVideoBytes() {
  return parsePositiveInt(process.env.VOUCH_MAX_VIDEO_BYTES, DEFAULT_MAX_VIDEO_BYTES);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function getProofMeta(proof) {
  const name = String(proof?.name || "").trim();
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";

  if (IMAGE_EXTENSIONS.has(ext)) {
    return { ext, proofType: "image" };
  }

  if (VIDEO_EXTENSIONS.has(ext)) {
    return { ext, proofType: "video" };
  }

  return { ext, proofType: null };
}

function validateProofAttachment(proof) {
  if (!proof) {
    return {
      ok: true,
      proofType: null,
      proofSize: 0,
    };
  }

  const { proofType } = getProofMeta(proof);
  if (!proofType) {
    return {
      ok: false,
      error: "Invalid proof file type. Allowed: PNG, JPG, JPEG, WEBP, GIF, MP4.",
    };
  }

  const proofSize = Number(proof.size || 0);
  const maxBytes = proofType === "video" ? getMaxVideoBytes() : getMaxImageBytes();

  if (proofSize > maxBytes) {
    return {
      ok: false,
      error: `Proof file is too large. ${proofType === "video" ? "Videos" : "Images"} must be ${formatBytes(maxBytes)} or smaller.`,
    };
  }

  return {
    ok: true,
    proofType,
    proofSize,
  };
}

function toTimestampMs(vouch) {
  const parsed = Date.parse(vouch?.timestamp || "");
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return 0;
}

function sortVouches(vouches) {
  vouches.sort((left, right) => {
    const tsDiff = toTimestampMs(left) - toTimestampMs(right);
    if (tsDiff !== 0) {
      return tsDiff;
    }
    return (left?.id || 0) - (right?.id || 0);
  });
  return vouches;
}

function normalizeVouches(vouches) {
  if (!Array.isArray(vouches)) {
    return [];
  }

  const newestByUser = new Map();
  const withoutUserId = [];

  for (const vouch of vouches) {
    if (!vouch || typeof vouch !== "object") {
      continue;
    }

    if (!vouch.user_id) {
      withoutUserId.push(vouch);
      continue;
    }

    const current = newestByUser.get(vouch.user_id);
    if (!current) {
      newestByUser.set(vouch.user_id, vouch);
      continue;
    }

    const currentTs = toTimestampMs(current);
    const nextTs = toTimestampMs(vouch);
    const shouldReplace =
      nextTs > currentTs ||
      (nextTs === currentTs && (vouch.id || 0) > (current.id || 0));

    if (shouldReplace) {
      newestByUser.set(vouch.user_id, vouch);
    }
  }

  return sortVouches([...withoutUserId, ...newestByUser.values()]);
}

function ensureVouchState(data) {
  if (!data || typeof data !== "object") {
    return { vouches: [], vouch_counter: 0 };
  }

  data.vouches = normalizeVouches(data.vouches);

  const maxId = data.vouches.reduce(
    (highest, vouch) => Math.max(highest, Number.isInteger(vouch?.id) ? vouch.id : 0),
    0
  );

  if (!Number.isInteger(data.vouch_counter) || data.vouch_counter < maxId) {
    data.vouch_counter = maxId;
  }

  return data;
}

function upsertUserVouch(data, nextVouch) {
  ensureVouchState(data);

  const replaced = data.vouches.filter((vouch) => vouch.user_id === nextVouch.user_id);
  data.vouches = data.vouches.filter((vouch) => vouch.user_id !== nextVouch.user_id);
  data.vouches.push(nextVouch);
  sortVouches(data.vouches);

  if (!Number.isInteger(data.vouch_counter) || data.vouch_counter < nextVouch.id) {
    data.vouch_counter = nextVouch.id;
  }

  return replaced;
}

module.exports = {
  ensureVouchState,
  formatBytes,
  getMaxImageBytes,
  getMaxVideoBytes,
  upsertUserVouch,
  validateProofAttachment,
};
