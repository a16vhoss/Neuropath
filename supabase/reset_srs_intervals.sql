-- Reset excessive SRS intervals
-- This script clamps interval_days and stability to max 60 days
-- and recalculates next_review_at accordingly

-- Update flashcard_srs_data where interval exceeds 60 days
UPDATE flashcard_srs_data
SET 
    interval_days = LEAST(interval_days, 60),
    stability = LEAST(stability, 60),
    next_review_at = CASE 
        WHEN interval_days > 60 THEN 
            last_review_at::timestamp + (60 * INTERVAL '1 day')
        ELSE 
            next_review_at
    END
WHERE interval_days > 60 OR stability > 60;

-- Show affected rows (optional verification)
SELECT 
    id,
    flashcard_id,
    interval_days,
    stability,
    next_review_at,
    state
FROM flashcard_srs_data
WHERE interval_days <= 60
ORDER BY next_review_at ASC;
