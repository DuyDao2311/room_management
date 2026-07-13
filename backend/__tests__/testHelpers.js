const jwt = require("jsonwebtoken");
const User = require("../models/User");

let userCounter = 0;
async function createUser(role) {
  userCounter++;
  return User.create({
    name: `Test ${role}`,
    email: `${role}${userCounter}@test.com`,
    password: "password123",
    role,
    isActive: true,
  });
}

function tokenFor(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET);
}

module.exports = { createUser, tokenFor };
