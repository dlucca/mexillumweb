// Envía el NDA unilateral (firmado por Mexillum) al lead vía DocuSeal.
// Devuelve { ok, skipped?, status? }. No lanza: los errores se registran y se
// devuelven, para que quien llama decida (fire-and-forget en los flujos de lead).
// Requiere env DOCUSEAL_URL, DOCUSEAL_API_TOKEN, DOCUSEAL_TEMPLATE_ID.
// Opcional: DOCUSEAL_ROLE (default 'Primera Parte').

const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

export async function sendNda({ nombre, correo, empresa }) {
  const url = process.env.DOCUSEAL_URL;
  const apiToken = process.env.DOCUSEAL_API_TOKEN;
  const templateId = Number(process.env.DOCUSEAL_TEMPLATE_ID);
  const email = clean(correo, 160);
  if (!url || !apiToken || !templateId) return { ok: false, skipped: 'config' };
  if (!email) return { ok: false, skipped: 'sin-correo' };

  const nombreL = clean(nombre, 120);
  const prospecto = clean(empresa, 160) || nombreL || email;
  const fecha = new Date().toISOString().slice(0, 10);
  const role = process.env.DOCUSEAL_ROLE || 'Primera Parte';

  const message = {
    subject: 'Tu Acuerdo de Confidencialidad con Mexillum',
    body: [
      'Hola,',
      '',
      'Gracias por tu interés en Mexillum. Adjunto encontrarás nuestro Acuerdo de Confidencialidad, firmado por Mexillum.',
      '',
      'Es un compromiso de nuestra parte: la información de tu operación que compartas para preparar tu anteproyecto (recibos, consumos, datos técnicos) la tratamos como confidencial. No necesitas firmar nada — es solo para tu tranquilidad.',
      '',
      'Nos vemos pronto.',
      'Equipo Mexillum'
    ].join('\n')
  };

  const submission = {
    template_id: templateId,
    send_email: true,
    message,
    submitters: [
      {
        role,
        email,
        name: nombreL || undefined,
        completed: true,
        fields: [
          { name: 'prospecto', default_value: prospecto, readonly: true },
          { name: 'fecha', default_value: fecha, readonly: true }
        ]
      }
    ]
  };

  try {
    const r = await fetch(`${url.replace(/\/+$/, '')}/api/submissions`, {
      method: 'POST',
      headers: { 'X-Auth-Token': apiToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(submission)
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('DocuSeal error', r.status, detail);
      return { ok: false, status: r.status };
    }
    return { ok: true };
  } catch (err) {
    console.error('sendNda error', err);
    return { ok: false, status: 0 };
  }
}
