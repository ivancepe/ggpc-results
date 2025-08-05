const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  try {
    const response = await fetch("https://script.google.com/macros/s/AKfycby5u6xbA1x3PtCKs51axBDBBidLgMHmf4VM_hP5bLWC1Hoy1OnqB1e4QnKtl4xQfUAJ/exec");

    // Check for non-200 HTTP status
    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: `Google Apps Script returned ${response.status} - ${errorText}`,
        }),
      };
    }

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid response from Google Apps Script. Expected JSON but got: ' + text.slice(0, 200),
        }),
      };
    }

    const json = await response.json();
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(json),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};
