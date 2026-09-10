export type SavedSearch={id:string;name:string;alertFrequency:string;updatedAt:string};
export type TalentPool={id:string;name:string;description:string|null;candidateCount:number;updatedAt:string};
export type Campaign={id:string;name:string;subject:string;status:string;recipientCount:number;sentCount:number;repliedCount:number;updatedAt:string};
export type Interview={id:string;candidateName:string;jobTitle:string;scheduledAt:string;status:string};
export type Analytics={savedSearches:number;talentPools:number;candidatesInPools:number;activeCampaigns:number;campaignsSent:number;interviewsThisWeek:number;scorecardsSubmitted:number;dueReminders?:number;pendingScorecards?:number;upcomingInterviews?:number};
export type OrganisationControls={currentUserRole:string;candidateRetentionDays:number;auditRetentionDays:number;savedSearchAlertsEnabled:boolean;campaignsEnabled:boolean;updatedAt:string;members:Array<{recruiterId:string;fullName:string;officialEmail:string;workspaceRole:string}>};
