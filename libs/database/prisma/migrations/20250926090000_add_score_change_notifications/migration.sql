-- Enable notifications for score changes across relevant tables
CREATE OR REPLACE FUNCTION public.notify_leaderboard_score_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  entity_id TEXT;
  occurred_at TIMESTAMPTZ;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    entity_id := OLD.id;
    occurred_at := now();
  ELSE
    entity_id := NEW.id;
    occurred_at := now();
  END IF;

  PERFORM pg_notify(
    'leaderboard_score_changed',
    json_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'id', entity_id,
      'occurredAt', occurred_at
    )::text
  );

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assignment_submission_score_notify
AFTER INSERT OR UPDATE OR DELETE ON "public"."AssignmentSubmission"
FOR EACH ROW EXECUTE FUNCTION public.notify_leaderboard_score_change();

CREATE TRIGGER progress_score_notify
AFTER INSERT OR UPDATE OR DELETE ON "public"."Progress"
FOR EACH ROW EXECUTE FUNCTION public.notify_leaderboard_score_change();

CREATE TRIGGER attempt_score_notify
AFTER INSERT OR UPDATE OR DELETE ON "public"."Attempt"
FOR EACH ROW EXECUTE FUNCTION public.notify_leaderboard_score_change();

CREATE TRIGGER podcast_attempt_score_notify
AFTER INSERT OR UPDATE OR DELETE ON "public"."podcast_attempts"
FOR EACH ROW EXECUTE FUNCTION public.notify_leaderboard_score_change();
