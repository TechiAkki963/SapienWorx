"use client";

import { useState } from "react";
import { Badge, Button, SectionTitle, WorkspaceShell } from "./ui";

const notifications = [
  { id: "interview", title: "Interview invitation received", copy: "Northstar Labs invited you to a portfolio conversation for the Product Designer role.", time: "12 min ago", type: "Interview", unread: true },
  { id: "view", title: "Your application was viewed", copy: "Maya Chen, Hiring Manager at Northstar Labs, viewed your profile for Product Designer.", time: "Today, 9:42 AM", type: "Profile activity", unread: true },
  { id: "shortlist", title: "You moved to screening", copy: "Tandem moved your Senior UX Designer application to the screening stage.", time: "Yesterday", type: "Application", unread: false },
  { id: "message", title: "New message from a recruiter", copy: "Jordan Reyes sent you a message about the Senior UX Designer opportunity.", time: "Yesterday", type: "Message", unread: false },
];

const schedule = [
  { day: 22, title: "Northstar portfolio conversation", time: "10:30 AM – 11:15 AM", host: "Maya Chen · Video call" },
  { day: 26, title: "Tandem recruiter screen", time: "3:00 PM – 3:30 PM", host: "Jordan Reyes · Video call" },
];

export function CandidateNotifications() {
  const [read, setRead] = useState<string[]>(notifications.filter((notification) => !notification.unread).map((notification) => notification.id));
  const markAllRead = () => setRead(notifications.map((notification) => notification.id));
  return <WorkspaceShell workspace="candidate" active="notifications" title="Notifications & schedule" description="Updates from recruiters about your applications and profile, plus your upcoming interviews." actions={<Button variant="secondary" onClick={markAllRead}>Mark all as read</Button>}>
    <div className="notification-layout"><div className="stack"><section className="panel"><SectionTitle eyebrow="Recruiter activity only" title="Your notifications"/><div className="notification-list">{notifications.map((notification) => <article className={read.includes(notification.id) ? "candidate-notification" : "candidate-notification unread"} key={notification.id}><span className={`notification-symbol ${notification.type.toLowerCase().replace(" ", "-")}`}>{notification.type === "Interview" ? "◷" : notification.type === "Message" ? "✉" : "◌"}</span><div><div className="notification-title"><strong>{notification.title}</strong>{!read.includes(notification.id) && <Badge tone="blue">New</Badge>}</div><p>{notification.copy}</p><small>{notification.time} · {notification.type}</small></div><button onClick={() => setRead([...read, notification.id])} aria-label={`Mark ${notification.title} as read`}>{read.includes(notification.id) ? "✓" : "●"}</button></article>)}</div></section><section className="panel notification-privacy-note"><span>✓</span><div><strong>Private by design</strong><p>These notifications contain only recruiter activity associated with your own applications and profile. You control your profile visibility in Profile settings.</p></div></section></div><aside className="stack"><Calendar/><section className="panel"><SectionTitle eyebrow="Upcoming" title="Scheduled conversations"/><div className="schedule-list">{schedule.map((event) => <article key={event.day}><span><b>{event.day}</b><small>AUG</small></span><div><strong>{event.title}</strong><p>{event.time}</p><small>{event.host}</small></div></article>)}</div><Button href="/candidate/messages" variant="quiet">Open message centre →</Button></section></aside></div>
  </WorkspaceShell>;
}

function Calendar() {
  const days = Array.from({ length: 31 }, (_, index) => index + 1);
  return <section className="panel calendar-card"><header><div><span className="eyebrow">Interview calendar</span><h2>August 2026</h2></div><button aria-label="Next month">›</button></header><div className="calendar-weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{Array.from({ length: 5 }, (_, index) => <span key={`blank-${index}`} />)}{days.map((day) => <button key={day} className={schedule.some((event) => event.day === day) ? "has-event" : day === 20 ? "today" : ""}>{day}</button>)}</div><footer><span><i/> Interview</span><span><i className="screen"/> Recruiter screen</span></footer></section>;
}

type Conversation = { id: string; name: string; role: string; initial: string; tone: string; preview: string; time: string; unread?: boolean; messages: { sender: "them" | "me"; text: string; time: string }[] };
const conversations: Conversation[] = [
  { id: "northstar", name: "Maya Chen", role: "Northstar Labs · Hiring Manager", initial: "MC", tone: "blue", preview: "Would Tuesday work for a short portfolio conversation?", time: "12 min", unread: true, messages: [{ sender: "them", text: "Hi Amara, I enjoyed reviewing your application for the Product Designer role.", time: "9:38 AM" }, { sender: "them", text: "Would Tuesday work for a short portfolio conversation?", time: "9:40 AM" }] },
  { id: "tandem", name: "Jordan Reyes", role: "Tandem · Talent Partner", initial: "JR", tone: "purple", preview: "Your screening is confirmed for Tuesday at 3 PM.", time: "Yesterday", messages: [{ sender: "them", text: "Thanks for your interest in the Senior UX Designer role. Your screening is confirmed for Tuesday at 3 PM.", time: "Yesterday" }, { sender: "me", text: "Thank you, Jordan. I have added it to my calendar and look forward to speaking.", time: "Yesterday" }] },
  { id: "plume", name: "Aria Khan", role: "Plume Health · Recruiter", initial: "AK", tone: "green", preview: "We will keep you updated as the role progresses.", time: "Mon", messages: [{ sender: "them", text: "We will keep you updated as the Product Designer role progresses.", time: "Monday" }] },
];

export function CandidateMessages() {
  const [activeId, setActiveId] = useState(conversations[0].id);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<Record<string, { text: string; time: string }[]>>({});
  const active = conversations.find((conversation) => conversation.id === activeId) ?? conversations[0];
  const send = () => { if (!draft.trim()) return; setSent({ ...sent, [active.id]: [...(sent[active.id] ?? []), { text: draft.trim(), time: "Now" }] }); setDraft(""); };
  return <WorkspaceShell workspace="candidate" active="messages" title="Message centre" description="Keep all recruiter messages and InMail related to your applications in one place.">
    <section className="message-center"><aside className="message-list"><header><div><span className="eyebrow">Messages & InMail</span><h2>Conversations</h2></div><span>{conversations.filter((conversation) => conversation.unread).length} new</span></header><label className="message-search"><span>⌕</span><input placeholder="Search conversations" aria-label="Search conversations"/></label>{conversations.map((conversation) => <button className={conversation.id === active.id ? "conversation active" : "conversation"} onClick={() => setActiveId(conversation.id)} key={conversation.id}><span className={`conversation-avatar ${conversation.tone}`}>{conversation.initial}</span><div><strong>{conversation.name}</strong><small>{conversation.role}</small><p>{conversation.preview}</p></div><span className="conversation-time">{conversation.unread ? <i/> : null}{conversation.time}</span></button>)}</aside><div className="conversation-panel"><header><div className="conversation-person"><span className={`conversation-avatar ${active.tone}`}>{active.initial}</span><div><strong>{active.name}</strong><small>{active.role}</small></div></div><Badge tone="green">Application open</Badge></header><div className="message-context"><span>Product Designer</span><p>Northstar Labs · Applied 2 days ago</p></div><div className="message-thread">{active.messages.map((message, index) => <div className={`message-bubble ${message.sender}`} key={`${message.time}-${index}`}><p>{message.text}</p><small>{message.time}</small></div>)}{(sent[active.id] ?? []).map((message, index) => <div className="message-bubble me" key={`sent-${index}`}><p>{message.text}</p><small>{message.time}</small></div>)}</div><footer className="message-composer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${active.name.split(" ")[0]}…`} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }}/><div><small>Enter to send · Shift + Enter for a new line</small><Button onClick={send} disabled={!draft.trim()}>Send message</Button></div></footer></div></section>
  </WorkspaceShell>;
}
