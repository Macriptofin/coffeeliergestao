-- Schedule daily cron job at 00:05 to update overdue status
SELECT cron.schedule(
  'update-overdue-status-daily',
  '5 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://njxxqdcwvehlvqufuyww.supabase.co/functions/v1/update-overdue-status',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qeHhxZGN3dmVobHZxdWZ1eXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MjgzMzAsImV4cCI6MjA3NDIwNDMzMH0.IlS_EBzrNr2i2gqd9zRGL75YK4PYr3QGIsjslfuipwg"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);