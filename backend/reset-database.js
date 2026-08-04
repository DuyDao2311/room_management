/**
 * ============================================================================
 * reset-database.js
 * ============================================================================
 *
 * XÓA TOÀN BỘ DỮ LIỆU NGHIỆP VỤ
 * GIỮ NGUYÊN:
 *   - User
 *   - Room
 *
 * Sau khi xóa:
 *   ✓ Reset avgRating
 *   ✓ Reset reviewCount
 *   ✓ occupied -> available
 *   ✓ Giữ nguyên maintenance
 *   ✓ Giữ nguyên viewCount
 *
 * Chạy:
 *   node reset-database.js
 *
 * Chế độ xem trước:
 *   node reset-database.js --dry-run
 *
 * Khuyến nghị:
 *   Backup database trước khi chạy.
 * ============================================================================
 */

require("dotenv").config();

const mongoose = require("mongoose");
const readline = require("readline");

const DRY_RUN = process.argv.includes("--dry-run");

const COLLECTIONS_TO_DELETE = [
  // Leaf
  "notifications",
  "favorites",
  "incidenttimelines",
  "expenses",

  // Near Leaf
  "payments",
  "feedbacks",
  "appointments",

  // Mid
  "invoices",
  "servicebookings",
  "bookings",
  "incidents",
  "promotions",

  // Core
  "contracts",

  // Foundation
  "services",
];

function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const startTime = new Date();

  try {
    console.clear();

    console.log("════════════════════════════════════════════════════");
    console.log("🧹 ROOM MANAGEMENT DATABASE RESET");
    console.log("════════════════════════════════════════════════════");
    console.log(`⏰ Start : ${startTime.toLocaleString()}`);
    console.log("");

    console.log("🔌 Connecting MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ Connected.\n");

    console.log("⚠️  RECOMMENDATION");
    console.log("Backup database before deleting data.");
    console.log("");
    console.log("Example:");
    console.log("mongodump --uri=\"$MONGO_URI\" --out ./backup");
    console.log("");

    const db = mongoose.connection.db;

    console.log("════════════════════════════════════════════════════");
    console.log("CURRENT DOCUMENT COUNT");
    console.log("════════════════════════════════════════════════════");

    console.log("\n🟢 KEEP");

    for (const collection of ["users", "rooms"]) {
      try {
        const count = await db.collection(collection).countDocuments();

        console.log(
          `${collection.padEnd(25)} ${count.toString().padStart(6)} docs`
        );
      } catch {
        console.log(`${collection.padEnd(25)} not found`);
      }
    }

    console.log("\n🔴 DELETE");

    let totalDelete = 0;

    for (const collection of COLLECTIONS_TO_DELETE) {
      try {
        const count = await db.collection(collection).countDocuments();

        totalDelete += count;

        console.log(
          `${collection.padEnd(25)} ${count.toString().padStart(6)} docs`
        );
      } catch {
        console.log(`${collection.padEnd(25)} not found`);
      }
    }

    console.log("\n════════════════════════════════════════════════════");
    console.log("SUMMARY");
    console.log("════════════════════════════════════════════════════");

    console.log(`Total documents to delete : ${totalDelete}`);
    console.log("User                      : KEEP");
    console.log("Room                      : KEEP");
    console.log("avgRating                 : RESET");
    console.log("reviewCount               : RESET");
    console.log("viewCount                 : KEEP");
    console.log("occupied                  : available");
    console.log("maintenance               : KEEP");
    console.log("");

    if (totalDelete === 0) {
      console.log("Nothing to delete.");
      process.exit(0);
    }

    if (DRY_RUN) {
      console.log("🟡 DRY RUN MODE");
      console.log("No data has been deleted.");
      process.exit(0);
    }

    const answer = await askConfirmation(
      'Type "YES" to continue: '
    );

    if (answer !== "YES") {
      console.log("\n❌ Cancelled.");
      process.exit(0);
    }

    console.log("\n🗑 Deleting business data...\n");

    let deletedTotal = 0;

    for (const collection of COLLECTIONS_TO_DELETE) {
      try {
        const result = await db.collection(collection).deleteMany({});

        deletedTotal += result.deletedCount;

        console.log(
          `✅ ${collection.padEnd(25)} deleted ${result.deletedCount}`
        );
      } catch {
        console.log(
          `⏭ ${collection.padEnd(25)} skipped`
        );
      }
    }

    console.log("\n🔄 Updating Room...\n");

    await db.collection("rooms").updateMany(
      {},
      {
        $set: {
          avgRating: 0,
          reviewCount: 0,
        },
      }
    );

    const roomResult = await db.collection("rooms").updateMany(
      {
        status: "occupied",
      },
      {
        $set: {
          status: "available",
        },
      }
    );

    console.log("✅ Rating reset");
    console.log(
      `✅ ${roomResult.modifiedCount} occupied rooms -> available`
    );
    console.log("✅ maintenance rooms unchanged");
    console.log("✅ viewCount unchanged");

    console.log("\n🔍 Verification\n");

    let remain = 0;

    for (const collection of COLLECTIONS_TO_DELETE) {
      try {
        const count = await db.collection(collection).countDocuments();

        remain += count;

        console.log(
          `${collection.padEnd(25)} ${count === 0 ? "✅ 0" : `⚠ ${count}`
          }`
        );
      } catch { }
    }

    const endTime = new Date();

    console.log("\n════════════════════════════════════════════════════");

    if (remain === 0) {
      console.log("🎉 DATABASE RESET SUCCESSFULLY");
    } else {
      console.log("⚠ DATABASE RESET COMPLETED WITH WARNINGS");
    }

    console.log("════════════════════════════════════════════════════");

    console.log(`Deleted documents : ${deletedTotal}`);
    console.log(`Remaining         : ${remain}`);
    console.log(`Started           : ${startTime.toLocaleString()}`);
    console.log(`Finished          : ${endTime.toLocaleString()}`);
    console.log(
      `Duration          : ${(
        (endTime - startTime) /
        1000
      ).toFixed(2)} seconds`
    );

    console.log("════════════════════════════════════════════════════");

    process.exit(0);
  } catch (err) {
    console.error("\n💥 ERROR");
    console.error(err);

    process.exit(1);
  }
}

main();