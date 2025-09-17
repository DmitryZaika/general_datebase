UPDATE deals
SET lost_reason = 'Never responded'
WHERE lost_reason = 'No response';