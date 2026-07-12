export interface Member {
  id: string;
  name: string;
  role: "Admin" | "Member" | "Moderator";
  avatarUrl: string;
  isOnline: boolean;
}
