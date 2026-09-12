-- Spot-problem reports used ON DELETE SET NULL plus a check that required
-- spot_id. Deleting a reported spot then failed. Keep the report, allow a
-- null spot after the pin is gone.
alter table public.user_feedback
  drop constraint if exists user_feedback_spot_problem_requires_spot;
