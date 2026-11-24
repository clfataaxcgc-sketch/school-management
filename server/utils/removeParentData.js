// One-time clean-up for databases created BEFORE the Parent Portal was removed.
//
//   node utils/removeParentData.js            -> dry run: only shows what would be deleted
//   node utils/removeParentData.js --apply    -> really deletes it (back up first!)
//
// It deletes:
//   - every user with role "parent"
//   - their conversations, the messages in them, and their notifications
//   - the whole "parents" collection
// and removes the old "parents" list from every student document.
//
// It uses the raw MongoDB collections on purpose: the Parent model no longer
// exists in the code, so Mongoose cannot be used for these old documents.
require("dotenv").config();
const mongoose = require("mongoose");

const apply = process.argv.includes("--apply");

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const parentUsers = await db.collection("users").find({ role: "parent" }).project({ _id: 1 }).toArray();
  const parentIds = parentUsers.map((u) => u._id);

  const conversations = await db
    .collection("conversations")
    .find({ participants: { $in: parentIds } })
    .project({ _id: 1 })
    .toArray();
  const conversationIds = conversations.map((c) => c._id);

  const counts = {
    parentUsers: parentIds.length,
    conversations: conversationIds.length,
    messages: await db.collection("messages").countDocuments({ conversation: { $in: conversationIds } }),
    notifications: await db.collection("notifications").countDocuments({ user: { $in: parentIds } }),
    parentProfiles: await db.collection("parents").countDocuments().catch(() => 0),
    studentsWithParentLinks: await db.collection("students").countDocuments({ parents: { $exists: true } }),
  };

  console.log(apply ? "Deleting:" : "DRY RUN - nothing is deleted. Found:", counts);

  if (apply) {
    await db.collection("messages").deleteMany({ conversation: { $in: conversationIds } });
    await db.collection("conversations").deleteMany({ _id: { $in: conversationIds } });
    await db.collection("notifications").deleteMany({ user: { $in: parentIds } });
    await db.collection("users").deleteMany({ _id: { $in: parentIds } });
    await db.collection("students").updateMany({}, { $unset: { parents: "" } });

    const collections = await db.listCollections({ name: "parents" }).toArray();
    if (collections.length > 0) await db.dropCollection("parents");
    console.log("Done.");
  } else {
    console.log("Run again with --apply to delete.");
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Failed:", error.message);
  process.exit(1);
});
