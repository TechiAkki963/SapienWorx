"use client";

import {createContext,useContext,useState,type ReactNode} from "react";

const ProfileContext=createContext<{open:boolean;setOpen:(open:boolean)=>void;profileImageUrl:string;setProfileImageUrl:(url:string)=>void}|null>(null);

export function RecruiterProfileProvider({children,initialProfileImageUrl=""}:{children:ReactNode;initialProfileImageUrl?:string}) {
  const [open,setOpen]=useState(false);
  const [profileImageUrl,setProfileImageUrl]=useState(initialProfileImageUrl);
  return <ProfileContext.Provider value={{open,setOpen,profileImageUrl,setProfileImageUrl}}>{children}</ProfileContext.Provider>;
}

export function useRecruiterProfile() {
  const value=useContext(ProfileContext);
  if(!value)throw new Error("Recruiter profile controls require the workspace provider.");
  return value;
}
