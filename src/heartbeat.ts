import { DEFAULT_USER_ROLE_ID } from "./config";


// Setup Heartbeat SDK
const sdk = require("api")("@heartbeat/v1.0#1879w36lly918zs");
const HB_API_TOKEN = process.env.HB_API_TOKEN;
sdk.auth(HB_API_TOKEN);

export type Group = {
  id: string;
  name: string;
}
export type Invite = {
  code: InviteCode;
  groups: Group[];
}
export type InviteCode = string;



export const createInvite = async (groupId: string): Promise<Invite | null> => {
  await sdk.createInvitation({
    roleID: DEFAULT_USER_ROLE_ID,
    groupIDs: [groupId],
  });

  const invites = await getInvitationsForGroup(groupId);
  return invites[0] || null;
};
export const getInvitationsForGroup = async (groupId) => {
  const invites = await sdk.getInvitations();
  const groupInvites = invites.data.filter((invite) => invite.groups.some((group) => group.id === groupId)
  );
  return groupInvites;
};
export const getGroup = async (groupId) => {
  return await sdk.getGroup({ groupID: groupId });
};
export const getInvitationsByCode = async (code) => {
  const invites = await sdk.getInvitations();
  const invite = invites.data.find((invite) => invite.code == code);
  return invite;
};
