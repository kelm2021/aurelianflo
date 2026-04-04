const { createApp } = require("./app");
const sellerConfig = require("./seller.config.json");

const app = createApp();

if (require.main === module) {
  const port = Number(process.env.PORT || sellerConfig.port || 4050);
  app.listen(port, () => {
    console.log(`finance-workflows listening on ${port}`);
  });
}

module.exports = app;
