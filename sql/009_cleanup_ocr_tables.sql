delete from public.flyer_page_processing
where status in ('processing')
  and processed_at < now() - interval '30 minutes';
