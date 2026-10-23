"use client";

import {createContext,useContext,useState,type ReactNode} from "react";

const ProfileContext=createContext<{open:boolean;setOpen:(open:boolean)=>void}|null>(null);

export function RecruiterProfileProvider({children}:{children:ReactNode}) {
  const [open,setOpen]=useState(false);
  return <ProfileContext.Provider value={{open,setOpen}}>{children}</ProfileContext.Provider>;
}

export function useRecruiterProfile() {
  const value=useContext(ProfileContext);
  if(!value)throw new Error("Recruiter profile controls require the workspace provider.");
  return value;
}
