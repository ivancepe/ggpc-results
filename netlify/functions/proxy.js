const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  try {
    const response = await fetch("https://script.google.com/macros/s/AKfycby5u6xbA1x3PtCKs51axBDBBidLgMHmf4VM_hP5bLWC1Hoy1OnqB1e4QnKtl4xQfUAJ/exec");

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ success: false, error: `Upstream returned ${response.status}` })
      };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        statusCode: 502,
        body: JSON.stringify({ success: false, error: 'Upstream did not return JSON' })
      };
    }

    const json = await response.json();

    // If there's a results array, sort newest-first.
    if (Array.isArray(json.results) && json.results.length > 0) {
      let results = [...json.results];

      // helper: detect best date-like key among object properties
      const detectDateKey = (items) => {
        const sample = items.slice(0, 10);
        const keys = Object.keys(items[0] || {});
        // prefer common names first
        const preferred = ['Timestamp','timestamp','Submitted At','submitted_at','created_at','Created','Date','date','Time','time'];
        for (const k of preferred) if (keys.includes(k)) return k;

        let bestKey = null;
        let bestScore = 0;
        for (const k of keys) {
          let score = 0;
          for (const it of sample) {
            const v = it[k];
            if (v === undefined || v === null) continue;
            // try Date parse
            const parsed = new Date(v);
            if (!isNaN(parsed)) score++;
            else {
              // if numeric string, try parseInt
              const n = Number(v);
              if (!Number.isNaN(n) && n > 0) {
                const d = new Date(n);
                if (!isNaN(d)) score++;
              }
            }
          }
          if (score > bestScore) { bestScore = score; bestKey = k; }
        }
        // require at least half of sample to be valid to accept
        return bestScore >= Math.ceil(sample.length / 2) ? bestKey : null;
      };

      const dateKey = detectDateKey(results);

      if (dateKey) {
        results.sort((a, b) => {
          const va = a[dateKey];
          const vb = b[dateKey];
          const da = new Date(va);
          const db = new Date(vb);
          // if both invalid, fallback to 0
          const ta = isNaN(da) ? (Number(va) || 0) : da.getTime();
          const tb = isNaN(db) ? (Number(vb) || 0) : db.getTime();
          return tb - ta;
        });
      } else {
        // fallback: look for numeric id/row/index and sort descending
        const numKey = Object.keys(results[0]).find(k => /^(id|ID|row|Row|index|Index)$/i.test(k));
        if (numKey) {
          results.sort((a, b) => (Number(b[numKey]) || 0) - (Number(a[numKey]) || 0));
        }
        // if still not sorted, keep original order (upstream order)
      }

      // Optional: support status filter via query string ?status=Done (case-insensitive, substring match)
      const params = (event && event.queryStringParameters) ? event.queryStringParameters : {};
      const statusFilterRaw = params.status ? String(params.status).trim() : '';
      const statusFilter = statusFilterRaw ? statusFilterRaw.toLowerCase() : '';

      if (statusFilter) {
        // prefer explicit status key names if present
        const possibleStatusKeys = ['Exam Status','ExamStatus','Status','status','exam_status','Exam_Status'];
        const statusKey = possibleStatusKeys.find(k => Object.prototype.hasOwnProperty.call(results[0], k));

        if (statusKey) {
          results = results.filter(r => {
            const v = r[statusKey];
            return v && String(v).toLowerCase().includes(statusFilter);
          });
        } else {
          // fallback: search any property containing 'status' in its key name
          results = results.filter(r => {
            return Object.keys(r).some(k => /status/i.test(k) && r[k] && String(r[k]).toLowerCase().includes(statusFilter));
          });
        }
      }

      json.results = results;
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, results: json.results || [] })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
