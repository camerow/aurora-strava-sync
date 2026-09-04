ALTER TABLE `sessions` ADD `top_send_grade` integer DEFAULT -1 NOT NULL;--> statement-breakpoint
UPDATE `sessions` SET `top_send_grade` = COALESCE((SELECT MAX(json_extract(c.value, '$.vGrade')) FROM json_each(`sessions`.`climbs_json`) c WHERE json_extract(c.value, '$.kind') = 'send'), -1) WHERE `climbs_json` IS NOT NULL;
