import { NextFunction, Request, Response } from "express";
import { REDIRECT_URL } from "./config";
import { GROUP_FULL_URL, MAX_USERS_PER_GROUP } from "./config";
import { TOKEN, port, API_URL } from "./env";
import {
  Invite,
  InviteCode,
  createInvite,
  getGroup,
  getInvitationsByCode,
  getInvitationsForGroup,
} from "./heartbeat";

const express = require("express");
const app = express();


enum InviteStatus {
  Valid,
  InvitationNotFound,
  GroupNotFound,
  GroupIsFull,
}

app.use(express.json());

// Auth
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (TOKEN && !req.headers?.authorization?.includes(TOKEN)) {
    return res.status(401).send("Unauthorized");
  }
  next();
};

// Routes
app.get("/", (req: Request, res: Response) => {
  res.send("Listening");
});

app.get("/invite/:inviteCode", async (req: Request, res: Response) => {
  const { inviteCode } = req.params;
  const validation = await validateInviteCode(inviteCode);
  switch (validation) {
    case InviteStatus.Valid:
      const url = `${REDIRECT_URL}?code=${inviteCode}`;
      console.log(`Invite code is valid: ${inviteCode}. Redirecting to ${url}`);
      return res.redirect(url);
    case InviteStatus.InvitationNotFound:
      return res.status(404).send("Invitation not found");
    case InviteStatus.GroupNotFound:
      return res.status(404).send("Group not found");
    case InviteStatus.GroupIsFull:
      return res.redirect(GROUP_FULL_URL);
    default:
      return res.status(500).send("Something went wrong");
  }
});

app.post("/invite", isAuthenticated, async (req: Request, res: Response) => {
  const { groupId, inviteUsers } = req.body;
  if (!groupId) {
    return res.status(400).send("Missing groupId");
  } else {
    const invite = await inviteByGroupId(groupId);
    if (!invite) {
      res.status(500).send("Something went wrong -  could not create invite");
    } else {
      console.log(`Invite created: ${invite.code}`);
      const link = inviteLinkFromInvite(invite);
      res.send(link);
    }
  }
});

app.listen(port, () => {
  console.log(`Example app listening now at ${API_URL}`);
});

// ============================
// Core logic
// ============================

const validateInviteCode = async (
  inviteCode: InviteCode
): Promise<InviteStatus> => {
  const regex = /^[a-zA-Z0-9]{6}$/;
  if (!regex.test(inviteCode)) return InviteStatus.InvitationNotFound;

  const invite = await getInvitationsByCode(inviteCode);
  if (!invite) return InviteStatus.InvitationNotFound;

  const { data: group } = await getGroup(invite.groups[0].id);
  if (!group) return InviteStatus.GroupNotFound;

  if (group.users.length >= MAX_USERS_PER_GROUP)
    return InviteStatus.GroupIsFull;

  return InviteStatus.Valid;
};

const inviteLinkFromInvite = (invite: Invite) =>
  `${API_URL}/invite/${invite.code}`;

const inviteByGroupId = async (groupId: string): Promise<Invite | null> => {
  try {
    const invites = await getInvitationsForGroup(groupId);
    return invites.length === 0 ? await createInvite(groupId) : invites[0];
  } catch (error) {
    console.error(`Error creating invite: ${JSON.stringify(error)}`);
    return null;
  }
};
