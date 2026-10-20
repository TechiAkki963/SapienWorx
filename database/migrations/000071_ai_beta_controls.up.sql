BEGIN;
-- Additive, disabled controls. Existing approvals/audit govern every enable.
INSERT INTO intelligence.engine_switches(switch_key,enabled,requires_approval_to_enable,description) VALUES
('openai_provider',false,true,'External OpenAI provider kill switch; does not enable a task.'),
('cv_ai_parse',false,true,'External CV parsing; candidate confirmation remains mandatory.'),
('job_ai_parse',false,true,'External JD parsing; recruiter confirmation remains mandatory.'),
('jd_ai_generation',false,true,'External JD drafting; explicit requirements and publication review remain mandatory.')
ON CONFLICT(switch_key) DO NOTHING;
COMMIT;
