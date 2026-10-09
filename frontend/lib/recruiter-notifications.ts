export const notificationCategories = [
 ["applications","Applications"],["interviews","Interviews"],["offers","Offers"],["jobs","Jobs"],
 ["messages","Messages"],["referrals","Referrals"],["talent","Talent alerts"],["system","Company & security"],
] as const;
export type RecruiterNotification = {id:string;category:string;title:string;message:string;created_at:string;read:boolean};
export type RecruiterNotificationInbox = {items:RecruiterNotification[];total:number;unread:number;page:number;limit:number};
export const notificationsChanged = () => window.dispatchEvent(new Event("swx-notifications-changed"));
