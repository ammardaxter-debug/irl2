-- =============================================
-- Reset Sequences to Max ID
-- Run this ONCE after data migration!
-- =============================================

SELECT setval('riders_id_seq', (SELECT COALESCE(MAX(id), 1) FROM riders));
SELECT setval('daily_logs_id_seq', (SELECT COALESCE(MAX(id), 1) FROM daily_logs));
SELECT setval('expenses_id_seq', (SELECT COALESCE(MAX(id), 1) FROM expenses));
SELECT setval('salary_advances_id_seq', (SELECT COALESCE(MAX(id), 1) FROM salary_advances));
SELECT setval('bonuses_id_seq', (SELECT COALESCE(MAX(id), 1) FROM bonuses));
SELECT setval('company_funds_id_seq', (SELECT COALESCE(MAX(id), 1) FROM company_funds));
SELECT setval('bikes_id_seq', (SELECT COALESCE(MAX(id), 1) FROM bikes));
SELECT setval('rider_requests_id_seq', (SELECT COALESCE(MAX(id), 1) FROM rider_requests));
SELECT setval('notifications_id_seq', (SELECT COALESCE(MAX(id), 1) FROM notifications));
SELECT setval('audit_logs_id_seq', (SELECT COALESCE(MAX(id), 1) FROM audit_logs));
