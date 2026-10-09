BEGIN;

-- In-app delivery only. No external email/SMS transport is introduced.
CREATE TABLE recruiter_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recipient_id uuid NOT NULL REFERENCES recruiter_profiles(user_id) ON DELETE CASCADE,
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 category text NOT NULL CHECK(category IN ('applications','interviews','offers','jobs','messages','referrals','talent','system')),
 title text NOT NULL, message text NOT NULL,
 entity_type text NOT NULL CHECK(entity_type IN ('application','interview','offer','job','thread','referral')),
 entity_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_recruiter_notifications_recipient ON recruiter_notifications(recipient_id,company_id,created_at DESC,id);
-- Includes stable virtual IDs for time-based reminders; intentionally no event FK.
CREATE TABLE recruiter_notification_state (
 recipient_id uuid NOT NULL REFERENCES recruiter_profiles(user_id) ON DELETE CASCADE,
 notification_id uuid NOT NULL, read_at timestamptz, dismissed_at timestamptz,
 PRIMARY KEY(recipient_id,notification_id)
);
CREATE TABLE recruiter_notification_preferences (
 recipient_id uuid PRIMARY KEY REFERENCES recruiter_profiles(user_id) ON DELETE CASCADE,
 muted_categories text[] NOT NULL DEFAULT '{}',
 CHECK(muted_categories <@ ARRAY['applications','interviews','offers','jobs','messages','referrals','talent','system']::text[])
);

CREATE FUNCTION recruiter_notification_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tenant uuid; recipient uuid; target uuid; kind text; bucket text; heading text;
BEGIN
 IF TG_TABLE_NAME='applications' THEN
   IF TG_OP='UPDATE' AND NEW.stage IS NOT DISTINCT FROM OLD.stage THEN RETURN NEW; END IF;
   SELECT company_id,coalesce(assigned_recruiter_id,created_by_recruiter_id) INTO tenant,recipient FROM jobs WHERE id=NEW.job_id;
   target:=NEW.id; kind:='application'; bucket:='applications';
   heading:=CASE WHEN TG_OP='INSERT' THEN 'New application received' ELSE 'Application status changed' END;
 ELSIF TG_TABLE_NAME='jobs' THEN
   IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
   tenant:=NEW.company_id; recipient:=coalesce(NEW.assigned_recruiter_id,NEW.created_by_recruiter_id);
   target:=NEW.id; kind:='job'; bucket:='jobs'; heading:='Job status changed';
 ELSIF TG_TABLE_NAME='interviews' THEN
   IF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.scheduled_at IS NOT DISTINCT FROM OLD.scheduled_at THEN RETURN NEW; END IF;
   INSERT INTO recruiter_notifications(recipient_id,company_id,category,title,message,entity_type,entity_id)
   SELECT p.recruiter_id,j.company_id,'interviews','Interview updated','Review the latest schedule and interview status.','interview',NEW.id
   FROM interview_panel p JOIN applications a ON a.id=NEW.application_id JOIN jobs j ON j.id=a.job_id
   JOIN recruiter_profiles rp ON rp.user_id=p.recruiter_id AND rp.company_id=j.company_id AND rp.verification_status='verified'
   WHERE p.interview_id=NEW.id;
   RETURN NEW;
 ELSIF TG_TABLE_NAME='interview_panel' THEN
   IF TG_OP='UPDATE' THEN RETURN NEW; END IF;
   SELECT j.company_id INTO tenant FROM interviews i JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id WHERE i.id=NEW.interview_id;
   recipient:=NEW.recruiter_id; target:=NEW.interview_id; kind:='interview'; bucket:='interviews'; heading:='Interview panel invitation';
 ELSIF TG_TABLE_NAME='recruiter_offers' THEN
   IF TG_OP='INSERT' AND NEW.status='draft' THEN RETURN NEW; END IF;
   IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
   tenant:=NEW.company_id; recipient:=NEW.recruiter_id; target:=NEW.id; kind:='offer'; bucket:='offers'; heading:='Offer status updated';
 ELSIF TG_TABLE_NAME='chat_messages' THEN
   IF NEW.sender_type<>'candidate' THEN RETURN NEW; END IF;
   SELECT rp.company_id,t.recruiter_id INTO tenant,recipient FROM chat_threads t JOIN recruiter_profiles rp ON rp.user_id=t.recruiter_id WHERE t.id=NEW.thread_id;
   target:=NEW.thread_id; kind:='thread'; bucket:='messages'; heading:='New candidate message';
 ELSIF TG_TABLE_NAME='referral_invitations' THEN
   IF TG_OP='UPDATE' AND NEW.accepted_at IS NOT DISTINCT FROM OLD.accepted_at AND NEW.applied_at IS NOT DISTINCT FROM OLD.applied_at AND NEW.declined_at IS NOT DISTINCT FROM OLD.declined_at THEN RETURN NEW; END IF;
   tenant:=NEW.company_id; recipient:=NEW.recruiter_id; target:=NEW.id; kind:='referral'; bucket:='referrals'; heading:='Referral invitation updated';
 END IF;
 INSERT INTO recruiter_notifications(recipient_id,company_id,category,title,message,entity_type,entity_id)
 SELECT recipient,tenant,bucket,heading,'Open the workflow to review this update.',kind,target
 FROM recruiter_profiles WHERE user_id=recipient AND company_id=tenant AND verification_status='verified';
 RETURN NEW;
END $$;
CREATE TRIGGER trg_recruiter_notify_application AFTER INSERT OR UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION recruiter_notification_event();
CREATE TRIGGER trg_recruiter_notify_job AFTER UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION recruiter_notification_event();
CREATE TRIGGER trg_recruiter_notify_interview AFTER UPDATE ON interviews FOR EACH ROW EXECUTE FUNCTION recruiter_notification_event();
CREATE TRIGGER trg_recruiter_notify_panel AFTER INSERT ON interview_panel FOR EACH ROW EXECUTE FUNCTION recruiter_notification_event();
CREATE TRIGGER trg_recruiter_notify_offer AFTER INSERT OR UPDATE ON recruiter_offers FOR EACH ROW EXECUTE FUNCTION recruiter_notification_event();
CREATE TRIGGER trg_recruiter_notify_message AFTER INSERT ON chat_messages FOR EACH ROW EXECUTE FUNCTION recruiter_notification_event();
CREATE TRIGGER trg_recruiter_notify_referral AFTER INSERT OR UPDATE ON referral_invitations FOR EACH ROW EXECUTE FUNCTION recruiter_notification_event();
COMMIT;
