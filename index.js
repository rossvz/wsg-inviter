const express = require("express");
const app = express();

// Environment variables and Infrastructre
const port = process.env.PORT || 3000;
const URL = process.env.URL || "http://localhost:3000";
const TOKEN = process.env.TOKEN;
const HB_API_TOKEN = process.env.HB_API_TOKEN;
const REDIRECT_URL =
  process.env.REDIRECT_URL || "https://insiders.worshipsoundguy.com/invitation";

// Config
const DEFAULT_USER_ROLE_ID =
  process.env.DEFAULT_USER_ROLE_ID || "5187dabd-cb0d-4ab6-80b1-8fcd494131ea";
const EXCLUDED_GROUP_IDS = [];
const MAX_USERS_PER_GROUP = process.env.MAX_USERS_PER_GROUP || 5;
const GROUP_FULL_URL =
  process.env.GROUP_FULL_URL ||
  "https://worshipsoundguy.com/insiders-team-limit-reached/";

// ===========================

// Setup Heartbeat SDK
const sdk = require("api")("@heartbeat/v1.0#1879w36lly918zs");
sdk.auth(HB_API_TOKEN);

app.use(express.json());

// Auth
const isAuthenticated = (req, res, next) => {
  if (!req.headers?.authorization?.includes(TOKEN)) {
    return res.status(401).send("Unauthorized");
  }
  next();
};

// Routes
app.get("/", (req, res) => {
  res.send("Listening");
});

app.get("/invite/:inviteCode", async (req, res) => {
  const { inviteCode } = req.params;
  const validation = await validateInviteCode(inviteCode);
  switch (validation) {
    case "OK":
      const url = `${REDIRECT_URL}?code=${inviteCode}`;
      console.log(`Invite code is valid: ${inviteCode}. Redirecting to ${url}`);
      return res.redirect(url);
    case "Invitation not found":
      return res.status(404).send("Invitation not found");
    case "Group not found":
      return res.status(404).send("Group not found");
    case "Group is full":
      return res.redirect(GROUP_FULL_URL);
    default:
      return res.status(500).send("Something went wrong");
  }
});

app.post("/invite", isAuthenticated, async (req, res) => {
  const { groupId, inviteUsers } = req.body;
  if (!groupId) {
    return res.status(400).send("Missing groupId");
  } else {
    const invite = await inviteByGroupId(groupId);
    if (!invite)
      return res
        .status(500)
        .send("Something went wrong - could not create invite");
    console.log(`Invite created: ${invite.code}`);
    const link = inviteLinkFromInvite(invite);
    res.send(link);
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

// ============================
// Core logic
// ============================

const validateInviteCode = async (inviteCode) => {
  const regex = /^[a-zA-Z0-9]{6}$/;
  if (!regex.test(inviteCode)) return "Invitation not found";
  const invite = await getInvitationsByCode(inviteCode);
  if (!invite) return "Invitation not found";

  const { data: group } = await getGroup(invite.groups[0].id);
  if (!group) return "Group not found";

  if (group.users.length >= MAX_USERS_PER_GROUP) return "Group is full";

  return "OK";
};

const inviteLinkFromInvite = (invite) => `${URL}/invite/${invite.code}`;

const inviteByGroupId = async (groupId) => {
  try {
    const invites = await getInvitationsForGroup(groupId);

    if (invites.length === 0) {
      return await createInvite(groupId);
    } else {
      return invites[0];
    }
  } catch (error) {
    console.error(`Error creating invite: ${JSON.stringify(error)}`);
  }
};

// ============================
// Interact with Heartbeat SDK
// ============================

const createInvite = async (groupId) => {
  await sdk.createInvitation({
    roleID: DEFAULT_USER_ROLE_ID,
    groupIDs: [groupId],
  });

  const invites = await getInvitationsForGroup(groupId);
  return invites[0];
};

const getInvitationsForGroup = async (groupId) => {
  const invites = await sdk.getInvitations();
  const groupInvites = invites.data.filter((invite) =>
    invite.groups.some((group) => group.id === groupId)
  );
  return groupInvites;
};

const getGroup = async (groupId) => {
  return await sdk.getGroup({ groupID: groupId });
};

const getInvitationsByCode = async (code) => {
  const invites = await sdk.getInvitations();
  const invite = invites.data.find((invite) => invite.code == code);
  return invite;
};
