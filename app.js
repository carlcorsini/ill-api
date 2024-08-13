const express = require('express');
const app = express();
const morgan = require('morgan');
const bodyParser = require('body-parser');
const port = process.env.PORT || 8000;
const cors = require('cors');
// const Helpers = require('./helpers');

if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use(bodyParser.json({ limit: '15mb' }));
app.use(cors());



app.get('/ill-api', async (req, res) => {
  let response = await fetch("https://data.illinois.gov/api/3/action/datastore_search?resource_id=fecd51fd-830f-4245-b4e0-9d952992f855&q=jones")
  let result = await response.json()
  console.log(result)
  res.status(200).send(result)
});


app.all('*', (req, res, next) => res.sendStatus(404));

app.use((err, req, res, next) => {
  res.status(err.status).json(err);
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Radio Server is running on ${port}!`);
  });
}

module.exports = app;