/* Lightweight syntax highlighting for T-SQL, AMPScript, and SSJS */

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function tokenize(code, rules) {
  const result = [];
  let pos = 0;
  while (pos < code.length) {
    let best = null;
    let bestIdx = code.length;
    for (const rule of rules) {
      rule.regex.lastIndex = pos;
      const match = rule.regex.exec(code);
      if (match && match.index < bestIdx) {
        bestIdx = match.index;
        best = { match, cls: rule.cls };
      }
    }
    if (!best || bestIdx === code.length) {
      result.push(escapeHtml(code.slice(pos)));
      break;
    }
    if (bestIdx > pos) {
      result.push(escapeHtml(code.slice(pos, bestIdx)));
    }
    result.push(`<span class="sh-${best.cls}">${escapeHtml(best.match[0])}</span>`);
    pos = bestIdx + best.match[0].length;
  }
  return result.join('');
}

const sqlRules = [
  { regex: /--[^\n]*/g, cls: 'comment' },
  { regex: /\/\*[\s\S]*?\*\//g, cls: 'comment' },
  { regex: /'(?:[^']|'')*'/g, cls: 'string' },
  { regex: /\b(?:SELECT|FROM|WHERE|AND|OR|NOT|IN|AS|ON|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|FULL|GROUP\s+BY|ORDER\s+BY|HAVING|UNION|INSERT|INTO|UPDATE|SET|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|DECLARE|BEGIN|END|IF|ELSE|THEN|CASE|WHEN|CAST|CONVERT|DATEADD|DATEDIFF|GETDATE|GETUTCDATE|ISNULL|COALESCE|NULL|IS|LIKE|BETWEEN|EXISTS|TOP|DISTINCT|COUNT|SUM|AVG|MIN|MAX|AT\s+TIME\s+ZONE|CONCAT|YEAR|MONTH|DAY|HOUR|MINUTE|SECOND)\b/gi, cls: 'keyword' },
  { regex: /\b(?:INT|BIGINT|VARCHAR|NVARCHAR|CHAR|NCHAR|DATETIME|DATE|TIME|BIT|FLOAT|DECIMAL|NUMERIC|TEXT|NTEXT)\b/gi, cls: 'type' },
  { regex: /\b\d+(?:\.\d+)?\b/g, cls: 'number' },
  { regex: /\[[^\]]+\]/g, cls: 'identifier' },
];

const ampRules = [
  { regex: /\/\*[\s\S]*?\*\//g, cls: 'comment' },
  { regex: /%%\[|%%\]|\]%%/g, cls: 'delimiter' },
  { regex: /'(?:[^']|'')*'/g, cls: 'string' },
  { regex: /"(?:[^"])*"/g, cls: 'string' },
  { regex: /\b(?:VAR|SET|IF|ELSE|ELSEIF|ENDIF|THEN|FOR|DO|NEXT|TO|DOWNTO)\b/gi, cls: 'keyword' },
  { regex: /\b(?:DateAdd|DateDiff|DatePart|DateParse|Format|Now|SystemDateToLocalDate|Lookup|LookupRows|LookupOrderedRows|InsertDE|UpdateDE|UpsertDE|Field|Row|RowCount|Concat|Substring|IndexOf|Length|Replace|Trim|ProperCase|Lowercase|Uppercase|IIF|Empty|IsNull|AttributeValue|RequestParameter|Output|RaiseError|Add|Subtract|Multiply|Divide|Mod)\b/g, cls: 'function' },
  { regex: /@\w+/g, cls: 'variable' },
  { regex: /\b\d+(?:\.\d+)?\b/g, cls: 'number' },
  { regex: /\[[^\]]+\]/g, cls: 'identifier' },
];

const ssjsRules = [
  { regex: /\/\/[^\n]*/g, cls: 'comment' },
  { regex: /\/\*[\s\S]*?\*\//g, cls: 'comment' },
  { regex: /'(?:[^'\\]|\\.)*'/g, cls: 'string' },
  { regex: /"(?:[^"\\]|\\.)*"/g, cls: 'string' },
  { regex: /`(?:[^`\\]|\\.)*`/g, cls: 'string' },
  { regex: /<\/?script[^>]*>/gi, cls: 'delimiter' },
  { regex: /\b(?:var|let|const|function|return|if|else|for|while|do|switch|case|break|continue|new|this|try|catch|finally|throw|typeof|instanceof|in|of|class|extends|import|export|default|true|false|null|undefined)\b/g, cls: 'keyword' },
  { regex: /\b(?:Platform|Load|Function|DateAdd|DateDiff|DatePart|Attribute|GetValue|Stringify|Parse|Write|Variable|SetValue|Rows|Lookup|LookupRows|InsertData|UpdateData|UpsertData|InvokeRetrieve|InvokeConfigure)\b/g, cls: 'function' },
  { regex: /\b\d+(?:\.\d+)?\b/g, cls: 'number' },
];

export function highlightSQL(code) {
  return tokenize(code, sqlRules);
}

export function highlightAMPScript(code) {
  return tokenize(code, ampRules);
}

export function highlightSSJS(code) {
  return tokenize(code, ssjsRules);
}
