// Fast drop-in for csv-reader 1.0.0 (make.fun).
// Same answers, same error objects, same order — single pass, slice-per-field
// instead of character-at-a-time string building.
// Dialect (from the competition rules, mirroring the reference exactly):
//  U+FEFF at start dropped; record ends LF/CRLF; empty line = no record;
//  lone CR outside quotes dropped (stray_cr); quoted field runs to the next
//  non-doubled quote, "" -> ", CRLF/lone CR inside -> LF; text after the
//  closing quote up to ,/line-break appended as-is (quote_junk when the
//  field ends); a never-closing quote is literal and the rest is re-read
//  as unquoted (unterminated_quote); quote in unquoted field is literal;
//  fields stay strings; columns = first record iff header; rows padded
//  (short_row, fields: count) or cut (long_row, extra: cut fields) to the
//  first record's width. Errors {code,line,row} in order met; line is the
//  1-based line the record starts on (counting LF/CRLF/lone CR inside
//  quotes); row is the record's index in rows, null for the header.

const COMMA = 0, LINE_BREAK = 1, END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  const n = text.length;
  let pos = 0;
  let line = 1;
  if (n > 0 && text.charCodeAt(0) === 0xFEFF) pos = 1;

  let recordLine = 1;
  let recordRow = null;

  // Rare-path reader: unquoted field starting at pos, with `init` already
  // in the value. Handles stray CRs (dropped + error) and returns how it
  // ended and how many characters it kept (for quote_junk detection).
  // Used only for quote-junk, unterminated quotes and stray-CR fields.
  function readUnquoted(init) {
    const parts = init ? [init] : [];
    let added = 0;
    let seg = pos;
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 44) { // ,
        if (pos > seg) { parts.push(text.slice(seg, pos)); added += pos - seg; }
        pos += 1;
        return { value: parts.join(''), ended: COMMA, added };
      }
      if (c === 10) { // \n
        if (pos > seg) { parts.push(text.slice(seg, pos)); added += pos - seg; }
        pos += 1; line += 1;
        return { value: parts.join(''), ended: LINE_BREAK, added };
      }
      if (c === 13) { // \r
        if (pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
          if (pos > seg) { parts.push(text.slice(seg, pos)); added += pos - seg; }
          pos += 2; line += 1;
          return { value: parts.join(''), ended: LINE_BREAK, added };
        }
        if (pos > seg) { parts.push(text.slice(seg, pos)); added += pos - seg; }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        pos += 1; seg = pos;
        continue;
      }
      pos += 1;
    }
    if (pos > seg) { parts.push(text.slice(seg, pos)); added += pos - seg; }
    return { value: parts.join(''), ended: END, added };
  }

  while (true) {
    // Empty lines are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) { pos += 1; line += 1; }
      else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) { pos += 2; line += 1; }
      else break;
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = (header && columns === null) ? null : rows.length;
    const fields = [];
    let ended;
    let quoted = false;

    do {
      quoted = text.charCodeAt(pos) === 34; // "
      let value;
      if (quoted) {
        const open = pos;
        const openLine = line;
        let close = text.indexOf('"', open + 1);
        let doubled = false;
        while (close !== -1 && close + 1 < n && text.charCodeAt(close + 1) === 34) {
          doubled = true;
          close = text.indexOf('"', close + 2);
        }
        if (close === -1) {
          // Never closes: literal quote, re-read the rest as unquoted.
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          pos = open + 1; line = openLine;
          const r = readUnquoted('"');
          value = r.value; ended = r.ended;
        } else {
          // Interior [open+1, close): transform only if it holds a doubled
          // quote, CR or LF; otherwise one slice.
          const hasDbl = doubled;
          const nl = text.indexOf('\n', open + 1);
          const cr = text.indexOf('\r', open + 1);
          if (!hasDbl && (nl === -1 || nl >= close) && (cr === -1 || cr >= close)) {
            value = text.slice(open + 1, close);
          } else {
            const parts = [];
            let start = open + 1;
            let i = open + 1;
            while (i < close) {
              const c = text.charCodeAt(i);
              if (c === 34) { // "" -> "
                parts.push(text.slice(start, i)); parts.push('"');
                i += 2; start = i;
              } else if (c === 13) { // CRLF / lone CR -> LF
                parts.push(text.slice(start, i)); parts.push('\n');
                line += 1;
                i += (i + 1 < close && text.charCodeAt(i + 1) === 10) ? 2 : 1;
                start = i;
              } else if (c === 10) {
                parts.push(text.slice(start, i)); parts.push('\n');
                line += 1;
                i += 1; start = i;
              } else {
                i += 1;
              }
            }
            parts.push(text.slice(start, close));
            value = parts.join('');
          }
          pos = close + 1;
          if (pos >= n) {
            ended = END;
          } else {
            const c = text.charCodeAt(pos);
            if (c === 44) { pos += 1; ended = COMMA; }
            else if (c === 10) { pos += 1; line += 1; ended = LINE_BREAK; }
            else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) { pos += 2; line += 1; ended = LINE_BREAK; }
            else {
              // Quote junk: appended as it stands up to ,/line-break.
              const r = readUnquoted(value);
              if (r.added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
              value = r.value; ended = r.ended;
            }
          }
        }
      } else {
        // Unquoted: scan to the next delimiter, slice once.
        let i = pos;
        while (i < n) {
          const c = text.charCodeAt(i);
          if (c === 44 || c === 10 || c === 13) break;
          i += 1;
        }
        if (i >= n) {
          value = text.slice(pos); pos = n; ended = END;
        } else {
          const c = text.charCodeAt(i);
          if (c === 44) { value = text.slice(pos, i); pos = i + 1; ended = COMMA; }
          else if (c === 10) { value = text.slice(pos, i); pos = i + 1; line += 1; ended = LINE_BREAK; }
          else if (i + 1 < n && text.charCodeAt(i + 1) === 10) { value = text.slice(pos, i); pos = i + 2; line += 1; ended = LINE_BREAK; }
          else {
            // Stray CR: rare path via the segment reader.
            const head = text.slice(pos, i);
            errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
            pos = i + 1;
            const r = readUnquoted(head);
            value = r.value; ended = r.ended;
          }
        }
      }
      fields.push(value);
    } while (ended === COMMA);

    // A line left with no characters (only stray CRs) is no record.
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) { columns = fields; continue; }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
