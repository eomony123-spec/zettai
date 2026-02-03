const GAME_URLS = {
  loto6: process.env.PAYPAY_LOTO6_CSV_URL,
  loto7: process.env.PAYPAY_LOTO7_CSV_URL,
  mini: process.env.PAYPAY_MINI_CSV_URL
};

exports.handler = async (event) => {
  try {
    const game = event.queryStringParameters && event.queryStringParameters.game;
    const target = GAME_URLS[game];
    if (!target) {
      return {
        statusCode: 400,
        body: "Invalid or missing game parameter."
      };
    }

    const response = await fetch(target, {
      headers: {
        "user-agent": "zettai-ataranaikun"
      }
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: "Failed to fetch CSV."
      };
    }

    const body = await response.text();

    return {
      statusCode: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=300"
      },
      body
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: "Unexpected error."
    };
  }
};
