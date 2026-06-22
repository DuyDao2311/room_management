const mongoose = require("mongoose");
const Room = require("./models/Room");
require("dotenv").config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Studio & 1 phòng ngủ -> short_term
    const res1 = await Room.updateMany(
      { type: { $in: ["Studio", "1 phòng ngủ"] } },
      { $set: { rentalMode: "short_term" } }
    );
    console.log(`Updated ${res1.modifiedCount} short_term rooms`);

    // Others -> long_term
    const res2 = await Room.updateMany(
      { type: { $nin: ["Studio", "1 phòng ngủ"] } },
      { $set: { rentalMode: "long_term" } }
    );
    console.log(`Updated ${res2.modifiedCount} long_term rooms`);

    console.log("Migration complete");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrate();
