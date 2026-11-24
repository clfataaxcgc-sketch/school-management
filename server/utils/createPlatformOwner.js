// Creates the platform owner (SaaS owner) account. There is NO public sign-up
// for this role, so it must be created from the command line:
//
//   PLATFORM_OWNER_EMAIL=owner@example.com PLATFORM_OWNER_PASSWORD='a-strong-password' \
//   node utils/createPlatformOwner.js
//
// (or put the two values in server/.env). It is safe to run twice.
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const run = async () => {
  const email = process.env.PLATFORM_OWNER_EMAIL;
  const password = process.env.PLATFORM_OWNER_PASSWORD;

  if (!email || !password) {
    throw new Error("Set PLATFORM_OWNER_EMAIL and PLATFORM_OWNER_PASSWORD first");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.log(`A user with email ${email} already exists (role: ${existing.role}). Nothing changed.`);
  } else {
    await User.create({
      firstName: process.env.PLATFORM_OWNER_FIRST_NAME || "Platform",
      lastName: process.env.PLATFORM_OWNER_LAST_NAME || "Owner",
      email,
      password,
      role: "platform_owner",
    });
    console.log(`Platform owner created: ${email}`);
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Could not create platform owner:", error.message);
  process.exit(1);
});
