exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Chat Editor API",
      endpoints: [
        "/api/token",
        "/api/chat/token"
      ]
    })
  };
};
