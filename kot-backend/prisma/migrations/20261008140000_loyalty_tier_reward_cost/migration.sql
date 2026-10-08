UPDATE `loyalty_rewards` AS lr
JOIN `loyalty_tiers` AS lt ON lt.`level` = lr.`tier_level`
SET lr.`points_required` = lt.`threshold_points`
WHERE lr.`tier_level` IS NOT NULL
  AND lt.`threshold_points` IS NOT NULL;
