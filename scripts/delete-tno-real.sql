DELETE FROM readings WHERE camera_id IN (SELECT camera_id FROM cameras WHERE name ILIKE '%TNO-real%');
DELETE FROM alerts WHERE camera_id IN (SELECT camera_id FROM cameras WHERE name ILIKE '%TNO-real%');
DELETE FROM camera_pins WHERE camera_id IN (SELECT camera_id FROM cameras WHERE name ILIKE '%TNO-real%');
DELETE FROM cameras WHERE name ILIKE '%TNO-real%';
