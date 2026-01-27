/**
 * Drop Sync Feature
 * Monitors the drops channel for .txt file uploads and syncs them to Firestore
 * Files are stored locally, metadata is stored in Firebase Firestore
 */

const admin = require("firebase-admin");
const fetch = require("node-fetch");
const path = require("path");
const fs = require("fs");

let firebaseInitialized = false;
let db = null;

// Local storage for files
const DROPS_DIR = path.join(__dirname, "..", "drops");

/**
 * Initialize Firebase Admin SDK (Firestore only, no Storage)
 */
function initializeFirebase() {
  if (firebaseInitialized) return true;

  const serviceAccountPath = path.join(__dirname, "..", "serviceAccount.json");

  if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ Firebase service account not found!");
    console.error("   Please download your service account key from Firebase Console:");
    console.error("   1. Go to Firebase Console > Project Settings > Service Accounts");
    console.error("   2. Click 'Generate new private key'");
    console.error("   3. Save the file as 'serviceAccount.json' in the bot folder");
    return false;
  }

  // Create drops directory for local file storage
  if (!fs.existsSync(DROPS_DIR)) {
    fs.mkdirSync(DROPS_DIR, { recursive: true });
    console.log("✅ Created local drops directory");
  }

  try {
    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    db = admin.firestore();
    firebaseInitialized = true;
    console.log("✅ Firebase Admin SDK initialized for drop sync (Firestore only)");
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize Firebase:", error.message);
    return false;
  }
}

/**
 * Download a file from a URL and return as a buffer
 */
async function downloadFile(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`);
  }
  return response.buffer();
}

/**
 * Save a file locally
 * Returns the local file path
 */
function saveFileLocally(buffer, fileName) {
  const safeName = fileName.replace(/\s+/g, "_");
  const uniqueName = `${Date.now()}_${safeName}`;
  const filePath = path.join(DROPS_DIR, uniqueName);

  fs.writeFileSync(filePath, buffer);

  return { fileName: uniqueName, localPath: filePath };
}

/**
 * Create a drop document in Firestore
 */
async function createDropDocument(title, description, fileName, localPath, fileContent, discordMessageId, discordUserId) {
  const dropRef = db.collection("drops").doc();

  await dropRef.set({
    title: title || fileName.replace(".txt", ""),
    description: description || "",
    type: "account",
    fileName,
    localPath,
    fileContent, // Store actual file content for reliable downloads
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    source: "discord",
    discordMessageId,
    discordUserId,
  });

  console.log(`✅ Drop synced to Firestore: ${title || fileName}`);
  return dropRef.id;
}

/**
 * Parse the drop title from the message content
 */
function parseDropTitle(content) {
  if (!content || !content.trim()) {
    return null;
  }

  let title = content.trim();
  const lines = title.split("\n");
  if (lines.length > 0) {
    title = lines[0].trim();
  }

  if (title.length > 80) {
    title = title.substring(0, 80);
  }

  return title;
}

/**
 * Parse description from message content (lines after the first)
 */
function parseDropDescription(content) {
  if (!content || !content.trim()) {
    return "";
  }

  const lines = content.trim().split("\n");
  if (lines.length <= 1) {
    return "";
  }

  let description = lines.slice(1).join("\n").trim();
  if (description.length > 240) {
    description = description.substring(0, 240);
  }

  return description;
}

/**
 * Check if a drop has already been synced by checking Firestore for the message ID
 */
async function isDropAlreadySynced(messageId) {
  if (!db) return false;

  try {
    const snapshot = await db.collection("drops")
      .where("discordMessageId", "==", messageId)
      .limit(1)
      .get();

    return !snapshot.empty;
  } catch (error) {
    console.error("Error checking if drop exists:", error.message);
    return false;
  }
}

/**
 * Process a message in the drops channel
 */
async function processDropMessage(message, config) {
  if (message.channel.id !== config.drops_channel_id) {
    return;
  }

  if (!message.attachments || message.attachments.size === 0) {
    return;
  }

  if (!initializeFirebase()) {
    console.warn("⚠️ Drop sync disabled - Firebase not configured");
    return;
  }

  const txtAttachments = message.attachments.filter(
    (attachment) => attachment.name && attachment.name.toLowerCase().endsWith(".txt")
  );

  if (txtAttachments.size === 0) {
    return;
  }

  console.log(`📥 Found ${txtAttachments.size} .txt file(s) in drops channel`);

  for (const [attachmentId, attachment] of txtAttachments) {
    try {
      // Download the file
      const fileBuffer = await downloadFile(attachment.url);

      // Save locally
      const { fileName, localPath } = saveFileLocally(fileBuffer, attachment.name);

      // Parse title and description
      const title = parseDropTitle(message.content) || attachment.name.replace(".txt", "");
      const description = parseDropDescription(message.content);

      // Get file content as string for Firestore storage
      const fileContent = fileBuffer.toString("utf-8");

      // Create Firestore document
      const dropId = await createDropDocument(
        title,
        description,
        fileName,
        localPath,
        fileContent, // Store actual content for reliable downloads
        message.id,
        message.author.id
      );

      // React to confirm
      await message.react("✅").catch(() => {});

      console.log(`📤 Synced drop: "${title}" (ID: ${dropId})`);
    } catch (error) {
      console.error(`❌ Failed to sync drop "${attachment.name}":`, error.message);
      await message.react("❌").catch(() => {});
    }
  }
}

/**
 * Sync existing drops from channel history
 */
async function syncExistingDrops(client, config) {
  if (!config.drops_channel_id) {
    console.log("⚠️ No drops_channel_id configured, skipping history sync");
    return;
  }

  if (!initializeFirebase()) {
    console.warn("⚠️ Drop sync disabled - Firebase not configured");
    return;
  }

  try {
    const channel = await client.channels.fetch(config.drops_channel_id);
    if (!channel || !channel.isTextBased()) {
      console.error("❌ Drops channel not found or is not a text channel");
      return;
    }

    console.log("📜 Fetching existing messages from drops channel...");

    let allMessages = [];
    let lastMessageId = null;
    let fetchedBatch;

    // Fetch messages in batches of 100
    do {
      const options = { limit: 100 };
      if (lastMessageId) {
        options.before = lastMessageId;
      }

      fetchedBatch = await channel.messages.fetch(options);
      allMessages = allMessages.concat([...fetchedBatch.values()]);

      if (fetchedBatch.size > 0) {
        lastMessageId = fetchedBatch.last().id;
      }
    } while (fetchedBatch.size === 100);

    console.log(`📜 Found ${allMessages.length} total messages in drops channel`);

    const messagesWithTxt = allMessages.filter(msg =>
      msg.attachments &&
      msg.attachments.some(att => att.name && att.name.toLowerCase().endsWith(".txt"))
    );

    console.log(`📥 Found ${messagesWithTxt.length} message(s) with .txt files`);

    let synced = 0;
    let skipped = 0;

    for (const message of messagesWithTxt) {
      const alreadySynced = await isDropAlreadySynced(message.id);
      if (alreadySynced) {
        skipped++;
        continue;
      }

      const txtAttachments = message.attachments.filter(
        (attachment) => attachment.name && attachment.name.toLowerCase().endsWith(".txt")
      );

      for (const [attachmentId, attachment] of txtAttachments) {
        try {
          const fileBuffer = await downloadFile(attachment.url);
          const { fileName, localPath } = saveFileLocally(fileBuffer, attachment.name);

          const title = parseDropTitle(message.content) || attachment.name.replace(".txt", "");
          const description = parseDropDescription(message.content);

          // Get file content as string for Firestore storage
          const fileContent = fileBuffer.toString("utf-8");

          await createDropDocument(
            title,
            description,
            fileName,
            localPath,
            fileContent, // Store actual content for reliable downloads
            message.id,
            message.author.id
          );

          synced++;
        } catch (error) {
          console.error(`❌ Failed to sync historical drop "${attachment.name}":`, error.message);
        }
      }
    }

    console.log(`✅ History sync complete: ${synced} new drops synced, ${skipped} already existed`);
  } catch (error) {
    console.error("❌ Error syncing existing drops:", error.message);
  }
}

/**
 * Check if drop sync is properly configured
 */
function isConfigured(config) {
  if (!config.drops_channel_id) {
    return { configured: false, reason: "drops_channel_id not set in config" };
  }

  const serviceAccountPath = path.join(__dirname, "..", "serviceAccount.json");
  if (!fs.existsSync(serviceAccountPath)) {
    return { configured: false, reason: "serviceAccount.json not found" };
  }

  return { configured: true };
}

module.exports = {
  processDropMessage,
  initializeFirebase,
  isConfigured,
  syncExistingDrops,
};
