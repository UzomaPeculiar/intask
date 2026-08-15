-- Recompute student ratings server-side.
--
-- The rate page previously recomputed rating_average/rating_count in the
-- browser and wrote the result to the reviewee's student_profiles row. RLS on
-- student_profiles only allows auth.uid() = user_id updates, so that write
-- (targeting another user) was silently rejected and ratings never updated.
-- This migration moves the recomputation into a SECURITY DEFINER function and
-- wires it to a reviews trigger, so stats are always consistent regardless of
-- the calling client and without depending on the student_profiles RLS chain.

CREATE OR REPLACE FUNCTION public.recompute_student_rating(_reviewee_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg NUMERIC;
  v_count INTEGER;
BEGIN
  IF _reviewee_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ROUND(AVG(rating)::NUMERIC, 2), COUNT(*)::INTEGER
  INTO v_avg, v_count
  FROM public.reviews
  WHERE reviewee_id = _reviewee_id;

  IF v_count = 0 THEN
    v_avg := 0;
  END IF;

  UPDATE public.student_profiles
  SET rating_average = v_avg,
      rating_count = v_count
  WHERE user_id = _reviewee_id;

  RETURN v_avg;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_student_rating(UUID) TO authenticated;

-- Trigger wrapper: forwards the affected row's reviewee to the recompute RPC.
-- Runs as the invoking user; the inner function is SECURITY DEFINER so it can
-- update student_profiles regardless of RLS.
CREATE OR REPLACE FUNCTION public.recompute_student_rating_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_student_rating(OLD.reviewee_id);
  ELSE
    PERFORM public.recompute_student_rating(NEW.reviewee_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS recompute_student_rating_on_reviews ON public.reviews;
CREATE TRIGGER recompute_student_rating_on_reviews
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.recompute_student_rating_trigger();

-- One-time backfill: bring existing ratings in line with the reviews that
-- were already submitted while the client-side recompute was silently failing.
UPDATE public.student_profiles sp
SET rating_average = sub.avg_rating,
    rating_count = sub.rating_count
FROM (
  SELECT reviewee_id,
         ROUND(AVG(rating)::NUMERIC, 2) AS avg_rating,
         COUNT(*)::INTEGER AS rating_count
  FROM public.reviews
  GROUP BY reviewee_id
) sub
WHERE sp.user_id = sub.reviewee_id;
