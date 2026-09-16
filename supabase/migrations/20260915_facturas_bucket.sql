-- Bucket privado del diagnóstico rápido (api/upload-url.js sube, api/lead.js firma).
-- Sin políticas anónimas: todo pasa por service-role y URLs firmadas.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('facturas','facturas',false,10485760,
  array['application/pdf','image/jpeg','image/png','image/heic','image/heif','image/webp'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
