/* Wartungstool · JS · Termin-Disposition (Outlook/ICS) */
/* ==========================================================================
   Termin-Disposition (Outlook Web + ICS für Desktop)
   ========================================================================== */
const localIso = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) +
  'T' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':00';
const fmtIso = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
const icsTime = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
const icsDay = (d) => String(d.getFullYear()) + p2(d.getMonth() + 1) + p2(d.getDate());

function terminBody(it) {
  return [
    'Zuständig: ' + (it.zustaendig || '-'),
    it.kommentar ? 'Hinweis: ' + it.kommentar : null,
    it.intervall ? 'Intervall: ' + it.intervall : null
  ].filter(Boolean).join('\n');
}
const terminOrt = (it) => (it.ort || ((it.objekt_nr || '') + ' ' + (it.objekt_name || ''))).trim();
const terminSubject = (it) => it.subject || it.taetigkeit || 'Wartung';

function outlookWebUrl(it, o) {
  const params = new URLSearchParams({
    path: '/calendar/action/compose', rru: 'addevent',
    subject: terminSubject(it), location: terminOrt(it),
    startdt: o.allDay ? fmtIso(o.start) : localIso(o.start),
    enddt: o.allDay ? fmtIso(o.ende) : localIso(o.ende),
    body: terminBody(it)
  });
  if (o.allDay) params.append('allday', 'true');
  const to = (o.attendees || []).filter(Boolean);
  if (to.length) params.append('to', to.join(';'));
  return 'https://outlook.office.com/calendar/deeplink/compose?' + params.toString();
}

function icsText(it, o) {
  const esc1 = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const uid = ((it.external_id || String(it.id)) + '-' + Date.now()) + '@wartungstool';
  const dtstart = o.allDay ? 'DTSTART;VALUE=DATE:' + icsDay(o.start) : 'DTSTART:' + icsTime(o.start);
  const dtend = o.allDay ? 'DTEND;VALUE=DATE:' + icsDay(o.ende) : 'DTEND:' + icsTime(o.ende);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wartungstool//DE', 'CALSCALE:GREGORIAN', 'METHOD:REQUEST',
    'BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + icsTime(new Date()),
    'SUMMARY:' + esc1(terminSubject(it)), 'LOCATION:' + esc1(terminOrt(it)),
    'DESCRIPTION:' + esc1(terminBody(it)), dtstart, dtend, 'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
}

function terminZielStandort(g) {
  return {
    key: 'loc:' + (g.nr || g.name), subject: 'Wartungsarbeiten Sammeltermin',
    ort: ((g.nr || '') + ' ' + (g.name || '')).trim(),
    zustaendig: uniq(g.items.map(i => i.zustaendig)).join(', '),
    extra: g.items.length + ' Positionen'
  };
}
function terminZielPosition(it) {
  return {
    key: keyOf(it), subject: it.taetigkeit || 'Wartung',
    ort: terminOrt(it), zustaendig: it.zustaendig, kommentar: it.kommentar,
    ab: it.ab, bis: it.bis
  };
}

function terminDialog(ziel) {
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const ab = parseDate(ziel.ab);
  const tag = (ab && ab > heute) ? ab : heute;
  const mails = (settings.dispoMail || CONFIG.dispoMail).split(',').map(x => x.trim()).filter(Boolean);

  return new Promise(resolve => {
    const scrim = document.createElement('div');
    scrim.className = 'modal-scrim';
    scrim.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<header><h3>Termin disponieren</h3><button class="close" data-x>' + svg(ICON.close, 16) + '</button></header>' +
        '<div class="body">' +
          '<div class="fld"><label for="dBetreff">Betreff</label>' +
            '<input class="inp" id="dBetreff" value="' + esc(ziel.subject) + '"></div>' +
          '<div class="row"><dt>Ort</dt><dd class="t-mono">' + esc(ziel.ort || '–') + '</dd></div>' +
          (ziel.zustaendig ? '<div class="row"><dt>Zuständig</dt><dd>' + esc(ziel.zustaendig) + '</dd></div>' : '') +
          '<div class="fld" style="margin-top:12px"><label>Art</label>' +
            '<div class="status-seg" id="dArt">' +
              '<button type="button" class="seg-btn" data-art="all" aria-pressed="true">Ganztägig</button>' +
              '<button type="button" class="seg-btn" data-art="time" aria-pressed="false">Mit Uhrzeit</button>' +
            '</div></div>' +
          '<div class="fld" id="dDayWrap"><label for="dTag">Datum</label>' +
            '<input class="inp" id="dTag" type="date" value="' + fmtIso(tag) + '"></div>' +
          '<div class="fgrid" id="dTimeWrap" hidden>' +
            '<div><label>Beginn</label><input class="inp" id="dStart" type="datetime-local" value="' + toLocalInput(zeitAm(tag)) + '"></div>' +
            '<div><label>Ende</label><input class="inp" id="dEnde" type="datetime-local" value="' + toLocalInput(endeAm(tag)) + '"></div>' +
          '</div>' +
          '<div class="fld"><label>Teilnehmer</label><div class="combo-host" id="dTeil"></div></div>' +
        '</div>' +
        '<div class="foot">' +
          '<button class="btn btn-ghost" data-ics>' + svg(ICON.download, 14) + 'ICS für Outlook</button>' +
          '<span style="flex:1"></span>' +
          '<button class="btn btn-tertiary" data-x>Abbrechen</button>' +
          '<button class="btn btn-primary" data-web>' + svg(ICON.calendar, 14) + 'In Outlook Web öffnen</button>' +
        '</div>' +
      '</div>';

    const art = () => scrim.querySelector('#dArt button[aria-pressed="true"]').dataset.art;
    scrim.querySelector('#dArt').addEventListener('click', e => {
      const b = e.target.closest('[data-art]'); if (!b) return;
      scrim.querySelectorAll('#dArt button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      const isAll = b.dataset.art === 'all';
      scrim.querySelector('#dDayWrap').hidden = !isAll;
      scrim.querySelector('#dTimeWrap').hidden = isAll;
    });

    comboBox(scrim.querySelector('#dTeil'), {
      options: uniq(mails.concat([CONFIG.dispoMail, settings.dispoMail])), selected: mails,
      multi: true, placeholder: 'E-Mail eingeben'
    });

    const collect = () => {
      const att = scrim.querySelector('#dTeil').dataset.value.split('|').map(x => x.trim()).filter(Boolean);
      const isAll = art() === 'all';
      const it = { subject: scrim.querySelector('#dBetreff').value.trim() || ziel.subject, ort: ziel.ort, zustaendig: ziel.zustaendig, kommentar: ziel.kommentar, external_id: ziel.key };
      if (isAll) {
        const d = scrim.querySelector('#dTag').value;
        const start = new Date(d + 'T00:00:00');
        return { allDay: true, start, ende: new Date(start.getTime() + 86400000), attendees: att, it };
      }
      const s1 = new Date(scrim.querySelector('#dStart').value), e1 = new Date(scrim.querySelector('#dEnde').value);
      return { allDay: false, start: s1, ende: e1, attendees: att, it };
    };

    const done = (v) => { scrim.remove(); resolve(v); };
    scrim.addEventListener('click', e => {
      if (e.target === scrim || e.target.closest('[data-x]')) return done(null);
      const isWeb = !!e.target.closest('[data-web]'), isIcs = !!e.target.closest('[data-ics]');
      if (!isWeb && !isIcs) return;
      const o = collect();
      if (o.attendees.length) { settings.dispoMail = o.attendees.join(', '); saveSettings(); }
      done({ action: isWeb ? 'web' : 'ics', o });
    });
    $('#overlay').appendChild(scrim);
  });
}

function zeitAm(tag) { const d = new Date(tag.getTime()); d.setHours(8, 30, 0, 0); return d; }
function endeAm(tag) { const d = new Date(tag.getTime()); d.setHours(11, 30, 0, 0); return d; }
function toLocalInput(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }

async function dispatchTermin(rec) {
  if (!rec) return;
  const ziel = rec.key ? rec : terminZielPosition(rec);
  const res = await terminDialog(ziel);
  if (!res) return;
  const it = res.o.it;
  if (res.action === 'web') {
    window.open(outlookWebUrl(it, res.o), '_blank', 'noopener,noreferrer');
    toast('Outlook Web geöffnet', { tone: 'success' });
  } else {
    download('Termin_' + ((it.ort || '') + '_' + (it.subject || 'Wartung')).replace(/[^\w.-]+/g, '_').slice(0, 50) + '.ics', icsText(it, res.o), 'text/calendar');
    toast('ICS-Datei erstellt', { tone: 'success' });
  }
}
