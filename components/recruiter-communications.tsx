"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "../lib/api-client";
import { Button, WorkspaceShell } from "./ui";
import styles from "./recruiter-communications.module.css";

type Template = { id: string; name: string; subject: string; bodyHtml: string; updatedAt: string };
type Conversation = { candidateId: string; candidateName: string; applicationId: string; jobTitle: string; applicationStage: string; lastMessageBody: string | null; activityAt: string; unreadCount: number };
type Message = { id: string; recipientId: string; body: string; sentAt: string };
type MessagePage = { content: Message[] };
type Draft = { id: string | null; name: string; subject: string; bodyHtml: string };

const EMPTY_DRAFT: Draft = { id: null, name: "", subject: "", bodyHtml: "" };
const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
};
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";

export function RecruiterCommunicationsWorkspace() {
  const params = useSearchParams();
  const candidateId = params.get("candidate") ?? "";
  const jobId = params.get("job") ?? "";
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [notice, setNotice] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(candidateId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState("");
  const [sending, setSending] = useState(false);

  const activeConversation = useMemo(() => conversations.find((item) => item.candidateId === activeCandidateId) ?? null, [conversations, activeCandidateId]);
  const selectedTemplate = templates.find((item) => item.id === selectedTemplateId) ?? null;

  const loadTemplates = async () => {
    try {
      const items = await apiClient<Template[]>("/api/recruiter/communications/templates");
      setTemplates(items);
      setSelectedTemplateId((current) => items.some((item) => item.id === current) ? current : (items[0]?.id ?? ""));
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : "Templates could not be loaded.");
    }
  };

  useEffect(() => { void loadTemplates(); }, []);
  useEffect(() => {
    void apiClient<Conversation[]>("/api/recruiter/communications/messages/conversations")
      .then((items) => {
        setConversations(items);
        setActiveCandidateId((current) => items.some((item) => item.candidateId === current) ? current : (items[0]?.candidateId ?? (candidateId || null)));
      })
      .catch((error) => setReplyError(error instanceof Error ? error.message : "Candidate conversations could not be loaded."));
  }, [candidateId]);
  useEffect(() => {
    if (!activeConversation) { setMessages([]); return; }
    void apiClient<MessagePage>(`/api/recruiter/communications/messages?with=${encodeURIComponent(activeConversation.candidateId)}`)
      .then((page) => setMessages(page.content))
      .catch((error) => setReplyError(error instanceof Error ? error.message : "This conversation could not be loaded."));
  }, [activeConversation?.candidateId]);
  useEffect(() => {
    if (!selectedTemplate) return;
    setSubject(selectedTemplate.subject);
    setBody(selectedTemplate.bodyHtml);
  }, [selectedTemplate]);

  async function saveTemplate() {
    if (!draft.name.trim() || !draft.subject.trim() || !draft.bodyHtml.trim()) { setTemplateError("Name, subject and message are required."); return; }
    setTemplateBusy(true); setTemplateError(""); setNotice("");
    try {
      const saved = await apiClient<Template>(draft.id ? `/api/recruiter/communications/templates/${draft.id}` : "/api/recruiter/communications/templates", {
        method: draft.id ? "PUT" : "POST",
        body: JSON.stringify({ name: draft.name.trim(), subject: draft.subject.trim(), bodyHtml: draft.bodyHtml.trim() }),
      });
      setDraft(EMPTY_DRAFT); setNotice(draft.id ? "Template updated." : "Template created.");
      await loadTemplates(); setSelectedTemplateId(saved.id);
    } catch (error) { setTemplateError(error instanceof Error ? error.message : "Template could not be saved."); }
    finally { setTemplateBusy(false); }
  }

  async function deleteTemplate(template: Template) {
    if (!window.confirm(`Delete “${template.name}”?`)) return;
    setTemplateBusy(true); setTemplateError(""); setNotice("");
    try {
      await apiClient<void>(`/api/recruiter/communications/templates/${template.id}`, { method: "DELETE" });
      if (draft.id === template.id) setDraft(EMPTY_DRAFT);
      setNotice("Template deleted."); await loadTemplates();
    } catch (error) { setTemplateError(error instanceof Error ? error.message : "Template could not be deleted."); }
    finally { setTemplateBusy(false); }
  }

  async function queueCandidateEmail() {
    if (!candidateId || !subject.trim() || !body.trim()) return;
    setSending(true); setTemplateError(""); setNotice("");
    try {
      await apiClient<string[]>("/api/recruiter/communications/bulk-email", {
        method: "POST",
        body: JSON.stringify({ candidateIds: [candidateId], jobId: jobId || null, subject: subject.trim(), htmlContent: body.trim() }),
      });
      setNotice("Candidate email queued for protected delivery.");
    } catch (error) { setTemplateError(error instanceof Error ? error.message : "Candidate email could not be queued."); }
    finally { setSending(false); }
  }

  async function sendReply() {
    if (!activeConversation || !reply.trim()) return;
    setSending(true); setReplyError("");
    try {
      const sent = await apiClient<Message>("/api/recruiter/communications/messages", {
        method: "POST",
        body: JSON.stringify({ recipientId: activeConversation.candidateId, applicationId: activeConversation.applicationId, body: reply.trim() }),
      });
      setMessages((items) => [...items, sent]); setReply("");
    } catch (error) { setReplyError(error instanceof Error ? error.message : "Reply could not be sent."); }
    finally { setSending(false); }
  }

  return <WorkspaceShell workspace="recruiter" active="communications" title="Communications" description="Templates, protected candidate emails and application-linked replies in one auditable workspace.">
    <section className={styles.section} aria-labelledby="inbox-title">
      <header className={styles.sectionHeader}><div><span className={styles.eyebrow}>Direct replies</span><h2 id="inbox-title">Candidate inbox</h2><p>Messages stay linked to their application context.</p></div></header>
      <div className={styles.inbox}>
        <aside className={styles.conversationList}>{conversations.length === 0 && !replyError && <p className={styles.state}>Candidate conversations will appear here.</p>}{conversations.map((item) => <button type="button" key={item.candidateId} className={`${styles.conversation} ${item.candidateId === activeCandidateId ? styles.active : ""}`} onClick={() => setActiveCandidateId(item.candidateId)}><span className={styles.avatar}>{initials(item.candidateName)}</span><span><strong>{item.candidateName}</strong><small>{item.jobTitle}</small><em>{item.lastMessageBody || "No message yet"}</em></span>{item.unreadCount > 0 && <b className={styles.unread}>{item.unreadCount}</b>}</button>)}</aside>
        <article className={styles.thread}>{activeConversation ? <><header><strong>{activeConversation.candidateName}</strong><small>{activeConversation.jobTitle} · {activeConversation.applicationStage.replaceAll("_", " ")}</small></header><div className={styles.messages}>{messages.length === 0 && <p className={styles.state}>No messages yet.</p>}{messages.map((message) => <div className={`${styles.message} ${message.recipientId === activeConversation.candidateId ? styles.mine : ""}`} key={message.id}><p>{message.body}</p><small>{formatDate(message.sentAt)}</small></div>)}</div><footer><label><span className={styles.label}>Reply</span><textarea value={reply} onChange={(event) => setReply(event.target.value)} /></label>{replyError && <p className={styles.error} role="alert">{replyError}</p>}<Button onClick={() => void sendReply()} disabled={!reply.trim() || sending}>{sending ? "Sending…" : "Send reply"}</Button></footer></> : <p className={styles.state}>Select a candidate conversation.</p>}</article>
      </div>
    </section>

    <section className={styles.section} aria-labelledby="templates-title">
      <header className={styles.sectionHeader}><div><span className={styles.eyebrow}>Reusable messaging</span><h2 id="templates-title">Template library</h2><p>Create, edit, select and delete recruiter-owned templates backed by the API.</p></div><Button variant="secondary" onClick={() => setDraft(EMPTY_DRAFT)}>New template</Button></header>
      {notice && <p className={styles.success} role="status">{notice}</p>}{templateError && <p className={styles.error} role="alert">{templateError}</p>}
      <div className={styles.templateLayout}><div className={styles.templateList}>{templates.length === 0 && <p className={styles.state}>No saved templates yet.</p>}{templates.map((template) => <article className={styles.templateCard} key={template.id}><button type="button" aria-pressed={selectedTemplateId === template.id} onClick={() => setSelectedTemplateId(template.id)}><strong>{template.name}</strong><span>{template.subject}</span><small>{formatDate(template.updatedAt)}</small></button><div><button type="button" onClick={() => setDraft({ id: template.id, name: template.name, subject: template.subject, bodyHtml: template.bodyHtml })}>Edit</button><button type="button" className={styles.danger} onClick={() => void deleteTemplate(template)} disabled={templateBusy}>Delete</button></div></article>)}</div>
        <form className={styles.editor} onSubmit={(event) => { event.preventDefault(); void saveTemplate(); }}><h3>{draft.id ? "Edit template" : "Create template"}</h3><label><span className={styles.label}>Name</span><input maxLength={160} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label><label><span className={styles.label}>Subject</span><input maxLength={250} value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} /></label><label><span className={styles.label}>Message</span><textarea rows={8} value={draft.bodyHtml} onChange={(event) => setDraft((current) => ({ ...current, bodyHtml: event.target.value }))} /></label><p className={styles.help}>No external AI service is used to generate or transform template content.</p><div className={styles.actions}><Button type="submit" disabled={templateBusy}>{templateBusy ? "Saving…" : draft.id ? "Save changes" : "Create template"}</Button>{draft.id && <Button variant="quiet" onClick={() => setDraft(EMPTY_DRAFT)}>Cancel</Button>}</div></form></div>
    </section>

    <section className={styles.section} aria-labelledby="email-title"><header className={styles.sectionHeader}><div><span className={styles.eyebrow}>Protected delivery</span><h2 id="email-title">Candidate email</h2><p>{candidateId ? "Recipient context came from Pipeline." : "Open this page from a Pipeline candidate before sending."}</p></div>{candidateId && <span className={styles.contextBadge}>Recipient linked</span>}</header><div className={styles.composeGrid}><div className={styles.editor}><label><span className={styles.label}>Template</span><select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}><option value="">Start without a template</option>{templates.map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}</select></label><label><span className={styles.label}>Subject</span><input maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} /></label><label><span className={styles.label}>Message</span><textarea rows={9} maxLength={10000} value={body} onChange={(event) => setBody(event.target.value)} /></label><p className={styles.help}>Candidate addresses are not exposed as a shared recipient list.</p><Button onClick={() => void queueCandidateEmail()} disabled={!candidateId || !subject.trim() || !body.trim() || sending}>{sending ? "Queuing…" : "Queue candidate email"}</Button></div><aside className={styles.preview}><span className={styles.eyebrow}>Preview</span><strong>{subject || "Subject preview"}</strong><p>{body || "Message preview"}</p><small>{jobId ? `Job context: ${jobId}` : "No job context linked"}</small></aside></div></section>
  </WorkspaceShell>;
}
