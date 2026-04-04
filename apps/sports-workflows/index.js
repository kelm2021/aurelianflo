const { createApp } = require("./app");

const port = Number(process.env.PORT || 4030);
const app = createApp();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`sports-workflows listening on ${port}`);
});
